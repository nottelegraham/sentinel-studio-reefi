"""GHL-style seasonal lighting for a ReeFi light, run by Home Assistant."""
from __future__ import annotations

import copy
import logging
import re
from typing import TYPE_CHECKING, Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.event import async_track_time_change
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .api import ReefiError
from .seasonal_math import GHL_TABLE, MODES, factors, inverse, minutes, transform

if TYPE_CHECKING:
    from .coordinator import ReefiCoordinator

_LOGGER = logging.getLogger(__name__)
DEFAULTS: dict[str, Any] = {"enabled": False, "table": GHL_TABLE, "midday": "15:50", "modes": {},
                            "base": None, "base_saved": None, "last": None}


class Seasonal:
    def __init__(self, hass: HomeAssistant, coordinator: ReefiCoordinator, entry_id: str) -> None:
        self.hass, self.c = hass, coordinator
        self.store = Store(hass, 1, f"reefi_seasonal_{entry_id}")
        self.cfg: dict[str, Any] = copy.deepcopy(DEFAULTS)
        self._unsub = None

    async def async_load(self) -> None:
        data = await self.store.async_load()
        if data:
            self.cfg.update(data)
        self._unsub = async_track_time_change(self.hass, self._daily, hour=0, minute=5, second=0)

    def unload(self) -> None:
        if self._unsub:
            self._unsub()

    async def _save(self) -> None:
        await self.store.async_save(self.cfg)

    @property
    def enabled(self) -> bool:
        return bool(self.cfg["enabled"] and self.cfg["base"])

    def today(self) -> tuple[float, float]:
        return factors(self.cfg["table"], dt_util.now().date())

    def view(self) -> dict:
        b, d = self.today()
        preview = (transform(self.cfg["base"], self.cfg["modes"], minutes(self.cfg["midday"]), b, d)
                   if self.cfg["base"] else None)
        return {**self.cfg, "today": {"date": dt_util.now().date().isoformat(),
                                      "brightness": round(b, 1), "duration": round(d, 1)},
                "preview": preview}

    async def capture_base(self) -> None:
        s = self.c.structured()
        pts = s["points"][: s["vm"]]
        self.cfg["base"] = [{"index": p["index"], "name": p["name"], "hr": p["hr"], "min": p["min"],
                             "master": p["master"]} for p in pts]
        old = self.cfg.get("modes") or {}
        self.cfg["modes"] = {str(p["index"]): old.get(str(p["index"]),
                             "fixed" if re.search("moon", p["name"], re.I) else "both") for p in pts}
        self.cfg["base_saved"] = dt_util.now().isoformat()
        await self._save()

    async def configure(self, enabled: bool | None = None, table: list | None = None,
                        midday: str | None = None, modes: dict | None = None) -> None:
        if table is not None:
            self.cfg["table"] = [[str(r[0]), float(r[1]), float(r[2])] for r in table]
        if midday is not None:
            minutes(midday)  # validates HH:MM
            self.cfg["midday"] = midday
        if modes is not None:
            for k, v in modes.items():
                if v not in MODES:
                    raise ValueError(f"Unknown mode {v}")
            self.cfg["modes"].update({str(k): v for k, v in modes.items()})
        if enabled is not None:
            self.cfg["enabled"] = enabled
            if enabled and not self.cfg["base"]:
                await self.capture_base()
        await self._save()
        if self.enabled:
            await self.apply()

    async def apply(self) -> int:
        """Write today's seasonal schedule to the light if it differs. Returns points changed."""
        if not self.enabled:
            return 0
        b, d = self.today()
        target = transform(self.cfg["base"], self.cfg["modes"], minutes(self.cfg["midday"]), b, d)
        cur = {p["index"]: p for p in self.c.structured()["points"]}
        changed = [t for t in target if t["index"] in cur and
                   (cur[t["index"]]["hr"], cur[t["index"]]["min"], cur[t["index"]]["master"]) != (t["hr"], t["min"], t["master"])]
        if changed:
            await self.c.async_save([{k: t[k] for k in ("index", "hr", "min", "master")} for t in changed],
                                    [], None, source="seasonal")
        self.cfg["last"] = {"date": dt_util.now().date().isoformat(), "at": dt_util.now().isoformat(),
                            "brightness": round(b, 1), "duration": round(d, 1), "changed": len(changed)}
        await self._save()
        return len(changed)

    async def startup(self) -> None:
        last = self.cfg.get("last") or {}
        if self.enabled and last.get("date") != dt_util.now().date().isoformat():
            await self._daily(None)

    async def _daily(self, _now) -> None:
        try:
            n = await self.apply()
            if n:
                _LOGGER.info("Seasonal: updated %s points on %s", n, self.c.api.host)
        except (ReefiError, ValueError) as err:
            _LOGGER.warning("Seasonal update failed: %s", err)

    async def on_user_save(self, points: list[dict]) -> None:
        """Schedule edits made while seasonal is on are kept as longest-day values."""
        if not self.enabled:
            return
        b, d = self.today()
        mid = minutes(self.cfg["midday"])
        base = {p["index"]: p for p in self.cfg["base"]}
        today = {t["index"]: t for t in transform(self.cfg["base"], self.cfg["modes"], mid, b, d)}
        for p in points:
            bp, tp = base.get(p["index"]), today.get(p["index"])
            if not bp or not tp:
                continue
            mode = self.cfg["modes"].get(str(p["index"]), "both")
            cur = {"hr": p.get("hr", tp["hr"]), "min": p.get("min", tp["min"]), "master": p.get("master", tp["master"])}
            back = inverse(cur, mode, mid, b, d)
            if (cur["hr"], cur["min"]) != (tp["hr"], tp["min"]):  # only touched fields move the base
                bp["hr"], bp["min"] = back["hr"], back["min"]
            if cur["master"] != tp["master"]:
                bp["master"] = back["master"]
            if "name" in p:
                bp["name"] = p["name"]
        await self._save()
