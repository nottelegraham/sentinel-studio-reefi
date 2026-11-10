"""Polls the light and holds schedule, profiles and live levels."""
from __future__ import annotations

import logging
import re
import time
from datetime import timedelta
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.event import async_call_later, async_track_time_interval
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.util import dt as dt_util

from .api import ReefiApi, ReefiError
from .const import NAME_MAX, NOW_TAIL, POINT_FIELDS, UNO2_WATTS

_LOGGER = logging.getLogger(__name__)
CFG_MAX_AGE = 300


def _int(v: Any, default: int = 0) -> int:
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return default


def clean_name(name: str) -> str:
    # commas, '=' and '&' would break the light's k=v,k=v format
    return re.sub(r"[,=&]", "", str(name)).strip()[:NAME_MAX]


class ReefiCoordinator(DataUpdateCoordinator[dict]):
    def __init__(self, hass: HomeAssistant, api: ReefiApi, entry: ConfigEntry) -> None:
        super().__init__(hass, _LOGGER, name=f"ReeFi {entry.title}",
                         update_interval=timedelta(seconds=10), config_entry=entry)
        self.api = api
        self._cfg: tuple[list[list[str]], list[list[str]]] | None = None
        self._cfg_at = 0.0
        self.override: dict[str, Any] | None = None
        self.seasonal = None
        self.labels: dict[str, str] = {}
        self.label_store = None
        self._ovr_unsubs: list = []

    async def _fetch_cfg(self) -> None:
        settings = await self.api.get_cfg("settings3.cfg")
        profiles = await self.api.get_cfg("profiles.cfg")
        self._cfg = (settings, profiles)
        self._cfg_at = time.monotonic()

    async def _async_update_data(self) -> dict:
        try:
            now = await self.api.get_cfg("now.cfg")
            if self._cfg is None or time.monotonic() - self._cfg_at > CFG_MAX_AGE:
                await self._fetch_cfg()
        except ReefiError as err:
            raise UpdateFailed(str(err)) from err
        if self.override and dt_util.utcnow() >= self.override["until"]:
            self.cancel_override()
        return {"now": now, "settings": self._cfg[0], "profiles": self._cfg[1]}

    # ---------- views ----------
    @property
    def settings(self) -> dict[str, str]:
        return dict(self.data["settings"]) if self.data else {}

    @property
    def now(self) -> dict[str, str]:
        return dict(self.data["now"]) if self.data else {}

    def levels(self) -> list[int]:
        n = self.now
        return [_int(n.get(f"nowch{k}")) for k in range(9)]

    def watts(self) -> float:
        return round(sum(v / 1023 * w for v, w in zip(self.levels(), UNO2_WATTS)), 1)

    def structured(self) -> dict:
        s, now = self.settings, self.now
        prof = dict(self.data["profiles"])
        points = []
        for i in range(20):
            if f"m{i}_name" not in s:
                break
            points.append({"index": i, "name": s.get(f"m{i}_name", ""), "hr": _int(s.get(f"m{i}_hr")),
                           "min": _int(s.get(f"m{i}_min")), "rate": _int(s.get(f"m{i}_rate")),
                           "pindex": _int(s.get(f"m{i}_pindex")), "master": _int(s.get(f"m{i}_master")),
                           "seasonal": _int(s.get(f"m{i}_seasonal"))})
        profiles = []
        for i in range(20):
            if f"p{i}_name" not in prof:
                break
            profiles.append({"index": i, "name": prof[f"p{i}_name"],
                             "ch": [_int(prof.get(f"p{i}_ch{k}")) for k in range(9)]})
        misc = {k: v for k, v in self.data["settings"] if not re.match(r"m\d+_", k)}
        return {
            "host": self.api.host,
            "vm": _int(s.get("VM"), len(points)),
            "points": points,
            "profiles": profiles,
            "settings": misc,
            "now": {**now, "nowch": self.levels()},
            "watts": self.watts(),
            "override": ({"profile": self.override["profile"], "until": self.override["until"].isoformat()}
                         if self.override else None),
            "server_time": dt_util.now().isoformat(),
            "seasonal": self.seasonal.view() if self.seasonal else None,
            "labels": self.labels,
        }

    # ---------- writes ----------
    async def async_save(self, points: list[dict], profiles: list[dict], vm: int | None, source: str = "user") -> None:
        await self._fetch_cfg()  # build on the light's current values, not a stale copy
        settings = [list(x) for x in self._cfg[0]]
        prof = [list(x) for x in self._cfg[1]]
        s_idx = {k: i for i, (k, _) in enumerate(settings)}
        p_idx = {k: i for i, (k, _) in enumerate(prof)}

        def put(table, idx, key, val):
            if key not in idx:
                raise ValueError(f"The light has no field {key}")
            table[idx[key]][1] = str(val)

        for p in points:
            i = p["index"]
            for f in POINT_FIELDS:
                if f in p:
                    put(settings, s_idx, f"m{i}_{f}", clean_name(p[f]) if f == "name" else int(p[f]))
        for p in profiles:
            i = p["index"]
            if "name" in p:
                put(prof, p_idx, f"p{i}_name", clean_name(p["name"]))
            for k, v in enumerate(p.get("ch", [])):
                put(prof, p_idx, f"p{i}_ch{k}", int(v))
        if vm:
            put(settings, s_idx, "VM", int(vm))
        now = await self.api.get_cfg("now.cfg")
        tail = [x for x in now if x[0] in NOW_TAIL]
        await self.api.save(settings, prof, tail)
        self._cfg_at = 0
        if source == "user" and self.seasonal:
            await self.seasonal.on_user_save(points)
        await self.async_request_refresh()

    async def async_quick_look(self, profile: int, minutes: int) -> None:
        prof = dict(self._cfg[1]) if self._cfg else dict((await self.api.get_cfg("profiles.cfg")))
        levels = [str(_int(prof.get(f"p{profile}_ch{k}"))) for k in range(9)]
        await self._send_levels(levels)
        self.cancel_override()
        self.override = {"profile": profile, "levels": levels,
                         "until": dt_util.utcnow() + timedelta(minutes=minutes)}
        # the light's own manual timer may be shorter than the hold; re-send while held
        self._ovr_unsubs.append(async_track_time_interval(self.hass, self._keepalive, timedelta(minutes=4)))
        self._ovr_unsubs.append(async_call_later(self.hass, minutes * 60, self._end_override))
        await self.async_request_refresh()

    async def _send_levels(self, levels: list[str]) -> None:
        now = await self.api.get_cfg("now.cfg")
        items = [[k, levels[int(k[5:])]] if re.fullmatch(r"nowch\d", k) else [k, v] for k, v in now]
        await self.api.send_now(items)

    async def _keepalive(self, _now) -> None:
        if self.override:
            try:
                await self._send_levels(self.override["levels"])
            except ReefiError as err:
                _LOGGER.warning("Quick look refresh failed: %s", err)

    async def _end_override(self, _now) -> None:
        self.cancel_override()
        try:
            await self.api.resume()
        except ReefiError as err:
            _LOGGER.warning("Resume after quick look failed: %s", err)
        await self.async_request_refresh()

    async def async_resume(self) -> None:
        self.cancel_override()
        await self.api.resume()
        await self.async_request_refresh()

    @callback
    def cancel_override(self) -> None:
        for unsub in self._ovr_unsubs:
            unsub()
        self._ovr_unsubs.clear()
        self.override = None

    async def async_sync_clock(self) -> None:
        s, now = self.settings, dt_util.now()
        params = [("Date", now.strftime("%Y-%m-%d")), ("Time", now.strftime("%H:%M")),
                  ("TimeZone", s.get("TZ", "0")), ("DLS", "true" if s.get("ADLS") == "1" else "false"),
                  ("POT", f"{_int(s.get('shr')):02d}:{_int(s.get('smin')):02d}"),
                  ("SelectDLS", s.get("SelectedDLS", "USA"))]
        await self.api.query("/SaveDateTime", params)
        await self.async_request_refresh()

    async def async_set_seasonal(self, sunrise: int, sunset: int, hemisphere: str,
                                 ignore_dst: bool, schedule_is_summer: bool) -> None:
        await self.api.query("/SaveSolMins", [("max_S_min", sunrise), ("max_S_min2", sunset),
                                              ("Hem", hemisphere), ("sol_DLS", int(ignore_dst)),
                                              ("SummerSolTime", int(schedule_is_summer))])
        self._cfg_at = 0
        await self.async_request_refresh()

    async def async_set_power_check(self, enabled: bool, ip: str) -> None:
        await self.api.query("/SavePwrCheck", [("POC", int(enabled)), ("POCip", ip or "0.0.0.0")])
        self._cfg_at = 0
        await self.async_request_refresh()
