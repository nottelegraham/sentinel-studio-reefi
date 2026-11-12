"""Sentinel Studio for ReeFi: local control of ReeFi Uno lights plus the Sentinel Studio card."""
from __future__ import annotations

from pathlib import Path

import voluptuous as vol

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_HOST, Platform
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.storage import Store

from . import websocket as reefi_ws
from .api import ReefiApi, ReefiError
from .const import CARD_VERSION, DEVICE_ACTIONS, DOMAIN, STATIC_URL
from .lovelace_resource import async_register_resource
from .coordinator import ReefiCoordinator
from .seasonal import Seasonal

PLATFORMS = [Platform.SENSOR]
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

INT = vol.Coerce(int)
POINT = vol.Schema({
    vol.Required("index"): vol.All(INT, vol.Range(0, 19)),
    vol.Optional("name"): cv.string,
    vol.Optional("hr"): vol.All(INT, vol.Range(0, 23)),
    vol.Optional("min"): vol.All(INT, vol.Range(0, 59)),
    vol.Optional("rate"): vol.All(INT, vol.Range(0, 240)),
    vol.Optional("pindex"): vol.All(INT, vol.Range(0, 19)),
    vol.Optional("master"): vol.All(INT, vol.Range(0, 100)),
    vol.Optional("seasonal"): vol.All(INT, vol.In([0, 1])),
}, extra=vol.REMOVE_EXTRA)
PROFILE = vol.Schema({
    vol.Required("index"): vol.All(INT, vol.Range(0, 19)),
    vol.Optional("name"): cv.string,
    vol.Optional("ch"): vol.All([vol.All(INT, vol.Range(0, 1023))], vol.Length(min=9, max=9)),
}, extra=vol.REMOVE_EXTRA)
ENTRY = {vol.Optional("entry_id"): cv.string}

SCHEMAS = {
    "save_schedule": vol.Schema({**ENTRY, vol.Optional("points", default=[]): [POINT],
                                 vol.Optional("profiles", default=[]): [PROFILE],
                                 vol.Optional("active_points"): vol.All(INT, vol.Range(1, 20))}),
    "quick_look": vol.Schema({**ENTRY, vol.Required("profile"): vol.All(INT, vol.Range(0, 19)),
                              vol.Optional("minutes", default=30): vol.All(INT, vol.Range(1, 480))}),
    "resume_schedule": vol.Schema(ENTRY),
    "sync_clock": vol.Schema(ENTRY),
    "device_action": vol.Schema({**ENTRY, vol.Required("action"): vol.In(list(DEVICE_ACTIONS))}),
    "set_seasonal": vol.Schema({**ENTRY, vol.Required("sunrise_minutes"): vol.All(INT, vol.Range(0, 240)),
                                vol.Required("sunset_minutes"): vol.All(INT, vol.Range(0, 240)),
                                vol.Required("hemisphere"): vol.In(["Northern", "Southern"]),
                                vol.Optional("ignore_dst", default=False): cv.boolean,
                                vol.Optional("schedule_is_summer", default=True): cv.boolean}),
    "set_power_check": vol.Schema({**ENTRY, vol.Required("enabled"): cv.boolean,
                                   vol.Optional("ip", default="0.0.0.0"): cv.string}),
    "seasonal_configure": vol.Schema({**ENTRY, vol.Optional("enabled"): cv.boolean,
                                      vol.Optional("table"): vol.All([vol.ExactSequence([
                                          vol.Match(r"^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$"),
                                          vol.All(vol.Coerce(float), vol.Range(1, 100)),
                                          vol.All(vol.Coerce(float), vol.Range(10, 100))])], vol.Length(min=2, max=48)),
                                      vol.Optional("midday"): vol.Match(r"^([01]\d|2[0-3]):[0-5]\d$"),
                                      vol.Optional("modes"): {cv.string: vol.In(["both", "time", "fixed"])}}),
    "seasonal_capture_base": vol.Schema(ENTRY),
    "set_point_label": vol.Schema({**ENTRY, vol.Required("index"): vol.All(INT, vol.Range(0, 19)),
                                   vol.Optional("label", default=""): vol.All(cv.string, vol.Length(max=40))}),
    "seasonal_apply": vol.Schema(ENTRY),
}


def get_coordinator(hass: HomeAssistant, entry_id: str | None) -> ReefiCoordinator:
    coords: dict[str, ReefiCoordinator] = hass.data.get(DOMAIN, {})
    if entry_id:
        if entry_id not in coords:
            raise ServiceValidationError(f"No ReeFi light with entry_id {entry_id}")
        return coords[entry_id]
    if len(coords) == 1:
        return next(iter(coords.values()))
    if not coords:
        raise ServiceValidationError("No ReeFi light is set up")
    raise ServiceValidationError("More than one ReeFi light is set up; pass entry_id")


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    hass.data.setdefault(DOMAIN, {})
    await hass.http.async_register_static_paths(
        [StaticPathConfig(STATIC_URL, str(Path(__file__).parent / "www"), False)])
    card = f"{STATIC_URL}/reefi-studio-card.js?v={CARD_VERSION}"
    add_extra_js_url(hass, card)
    # Phone apps cache the start page; dashboard resources are always fetched fresh.
    async_register_resource(hass, f"{STATIC_URL}/reefi-studio-card.js", card)
    reefi_ws.async_register(hass)

    async def handle(call: ServiceCall) -> None:
        c = get_coordinator(hass, call.data.get("entry_id"))
        d = call.data
        try:
            if call.service == "save_schedule":
                await c.async_save(d["points"], d["profiles"], d.get("active_points"))
            elif call.service == "quick_look":
                await c.async_quick_look(d["profile"], d["minutes"])
            elif call.service == "resume_schedule":
                await c.async_resume()
            elif call.service == "sync_clock":
                await c.async_sync_clock()
            elif call.service == "device_action":
                await c.api.action(DEVICE_ACTIONS[d["action"]])
                await c.async_request_refresh()
            elif call.service == "set_seasonal":
                await c.async_set_seasonal(d["sunrise_minutes"], d["sunset_minutes"], d["hemisphere"],
                                           d["ignore_dst"], d["schedule_is_summer"])
            elif call.service == "set_power_check":
                await c.async_set_power_check(d["enabled"], d["ip"])
            elif call.service == "seasonal_configure":
                await c.seasonal.configure(d.get("enabled"), d.get("table"), d.get("midday"), d.get("modes"))
                await c.async_request_refresh()
            elif call.service == "set_point_label":
                label = d["label"].strip()[:24]
                if label:
                    c.labels[str(d["index"])] = label
                else:
                    c.labels.pop(str(d["index"]), None)
                await c.label_store.async_save(c.labels)
                c.async_update_listeners()
            elif call.service == "seasonal_capture_base":
                await c.seasonal.capture_base()
                await c.async_request_refresh()
            elif call.service == "seasonal_apply":
                await c.seasonal.apply()
                await c.async_request_refresh()
        except ReefiError as err:
            raise HomeAssistantError(str(err)) from err
        except ValueError as err:
            raise ServiceValidationError(str(err)) from err

    for name, schema in SCHEMAS.items():
        hass.services.async_register(DOMAIN, name, handle, schema=schema)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    api = ReefiApi(async_get_clientsession(hass), entry.data[CONF_HOST])
    coordinator = ReefiCoordinator(hass, api, entry)
    await coordinator.async_config_entry_first_refresh()
    coordinator.label_store = Store(hass, 1, f"reefi_labels_{entry.entry_id}")
    coordinator.labels = await coordinator.label_store.async_load() or {}
    coordinator.seasonal = Seasonal(hass, coordinator, entry.entry_id)
    await coordinator.seasonal.async_load()
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = coordinator
    entry.async_create_background_task(hass, coordinator.seasonal.startup(), "reefi_seasonal_startup")
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if ok:
        c = hass.data[DOMAIN].pop(entry.entry_id)
        c.cancel_override()
        if c.seasonal:
            c.seasonal.unload()
    return ok
