"""WebSocket command the Sentinel Studio card uses to read everything in one call."""
from __future__ import annotations

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN


@callback
def async_register(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_data)


@websocket_api.websocket_command({vol.Required("type"): "reefi/data", vol.Optional("entry_id"): str})
@callback
def ws_data(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    coords = hass.data.get(DOMAIN, {})
    eid = msg.get("entry_id") or (next(iter(coords)) if len(coords) == 1 else None)
    if not eid or eid not in coords:
        connection.send_error(msg["id"], "not_found",
                              "No ReeFi light found. Add it under Settings > Devices & services, "
                              "or set entry_id on the card when you have more than one.")
        return
    c = coords[eid]
    if not c.data:
        connection.send_error(msg["id"], "unavailable", f"Waiting for the first reply from {c.api.host}")
        return
    connection.send_result(msg["id"], {"entry_id": eid, "title": c.config_entry.title,
                                       "available": c.last_update_success, **c.structured()})
