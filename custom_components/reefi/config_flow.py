"""Config flow: enter the light's IP address."""
from __future__ import annotations

import voluptuous as vol

from homeassistant.config_entries import ConfigFlow
from homeassistant.const import CONF_HOST
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import ReefiApi, ReefiError
from .const import DOMAIN


class ReefiConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        errors = {}
        if user_input is not None:
            api = ReefiApi(async_get_clientsession(self.hass), user_input[CONF_HOST])
            try:
                info = await api.get_host_info()
                await api.get_cfg("now.cfg")
            except ReefiError:
                errors["base"] = "cannot_connect"
            else:
                await self.async_set_unique_id(info["mac"].lower().replace(":", ""))
                self._abort_if_unique_id_configured(updates={CONF_HOST: api.host})
                return self.async_create_entry(title=info["hostname"] or api.host, data={CONF_HOST: api.host})
        default = (user_input or {}).get(CONF_HOST, "")
        return self.async_show_form(step_id="user",
                                    data_schema=vol.Schema({vol.Required(CONF_HOST, default=default): str}),
                                    errors=errors)
