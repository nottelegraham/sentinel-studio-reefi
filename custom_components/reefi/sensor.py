"""Sensors for live ReeFi output."""
from __future__ import annotations

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import PERCENTAGE, UnitOfPower
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import CHANNEL_KEYS, CHANNELS, DOMAIN
from .coordinator import ReefiCoordinator


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, add: AddEntitiesCallback) -> None:
    c: ReefiCoordinator = hass.data[DOMAIN][entry.entry_id]
    ents: list[SensorEntity] = [PowerSensor(c), AverageSensor(c), ModeSensor(c), MoonSensor(c)]
    ents += [ChannelSensor(c, k) for k in range(9)]
    add(ents)


class ReefiEntity(CoordinatorEntity[ReefiCoordinator], SensorEntity):
    _attr_has_entity_name = True

    def __init__(self, c: ReefiCoordinator, key: str) -> None:
        super().__init__(c)
        uid = c.config_entry.unique_id or c.config_entry.entry_id
        self._attr_unique_id = f"{uid}_{key}"
        s = c.settings
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, uid)}, name=c.config_entry.title, manufacturer="ReeFi",
            model=f"{s.get('ModelType', 'Uno')} LED", sw_version=c.now.get("Ver"),
            configuration_url=f"http://{c.api.host}/")


class PowerSensor(ReefiEntity):
    _attr_name = "Power"
    _attr_device_class = SensorDeviceClass.POWER
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = UnitOfPower.WATT
    _attr_suggested_display_precision = 0

    def __init__(self, c):
        super().__init__(c, "power")

    @property
    def native_value(self):
        return self.coordinator.watts()


class AverageSensor(ReefiEntity):
    _attr_name = "Channel average"
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = PERCENTAGE
    _attr_suggested_display_precision = 1
    _attr_icon = "mdi:brightness-percent"

    def __init__(self, c):
        super().__init__(c, "average")

    @property
    def native_value(self):
        return round(sum(self.coordinator.levels()) / 1023 / 9 * 100, 1)


class ModeSensor(ReefiEntity):
    _attr_name = "Mode"
    _attr_icon = "mdi:timeline-clock-outline"

    def __init__(self, c):
        super().__init__(c, "mode")

    @property
    def native_value(self):
        if self.coordinator.override:
            return "Quick look"
        return self.coordinator.now.get("cMode")


class MoonSensor(ReefiEntity):
    _attr_name = "Moon illumination"
    _attr_native_unit_of_measurement = PERCENTAGE
    _attr_icon = "mdi:moon-waning-crescent"

    def __init__(self, c):
        super().__init__(c, "moon")

    @property
    def native_value(self):
        try:
            return int(self.coordinator.now.get("cMoon"))
        except (TypeError, ValueError):
            return None


class ChannelSensor(ReefiEntity):
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = PERCENTAGE
    _attr_suggested_display_precision = 0
    _attr_icon = "mdi:led-on"
    _attr_entity_registry_enabled_default = True

    def __init__(self, c, k: int):
        super().__init__(c, CHANNEL_KEYS[k])
        self._k = k
        self._attr_name = CHANNELS[k]

    @property
    def native_value(self):
        return round(self.coordinator.levels()[self._k] / 1023 * 100, 1)
