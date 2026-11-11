"""WebSocket commands the Sentinel Studio card uses."""
from __future__ import annotations

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN


@callback
def async_register(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_data)
    websocket_api.async_register_command(hass, ws_lights)


def _lights(hass: HomeAssistant) -> list[dict]:
    return [{"entry_id": eid, "title": c.config_entry.title, "host": c.api.host}
            for eid, c in hass.data.get(DOMAIN, {}).items()]


def _resolve(hass: HomeAssistant, entry_id: str | None, light: str | None) -> tuple[str | None, str, str]:
    """Return (entry_id, error_code, error_message). entry_id is None on error."""
    coords = hass.data.get(DOMAIN, {})
    if not coords:
        return None, "not_found", "No ReeFi light is set up. Add it under Settings > Devices & services."
    if entry_id:
        if entry_id in coords:
            return entry_id, "", ""
        return None, "not_found", f"No ReeFi light with entry_id {entry_id}."
    if light:
        want = light.strip().lower()
        for eid, c in coords.items():
            if want in (c.config_entry.title.strip().lower(), str(c.api.host).lower()):
                return eid, "", ""
        names = ", ".join(f'"{c.config_entry.title}"' for c in coords.values())
        return None, "not_found", f'No ReeFi light named "{light}". Lights set up: {names}.'
    if len(coords) == 1:
        return next(iter(coords)), "", ""
    return None, "choose_light", "More than one ReeFi light is set up. Pick one."


@websocket_api.websocket_command({vol.Required("type"): "reefi/lights"})
@callback
def ws_lights(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    connection.send_result(msg["id"], {"lights": _lights(hass)})


@websocket_api.websocket_command({vol.Required("type"): "reefi/data",
                                  vol.Optional("entry_id"): str, vol.Optional("light"): str})
@callback
def ws_data(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    eid, code, text = _resolve(hass, msg.get("entry_id"), msg.get("light"))
    if not eid:
        connection.send_error(msg["id"], code, text)
        return
    coords = hass.data[DOMAIN]
    c = coords[eid]
    if not c.data:
        connection.send_error(msg["id"], "unavailable", f"Waiting for the first reply from {c.api.host}")
        return
    connection.send_result(msg["id"], {"entry_id": eid, "title": c.config_entry.title,
                                       "light_count": len(coords),
                                       "available": c.last_update_success, **c.structured()})
