"""Constants for Sentinel Studio for ReeFi."""
DOMAIN = "reefi"
CARD_VERSION = "0.1.4"
STATIC_URL = "/reefi_static"

# cfg channel order: 395, 420, violet, royal blue, blue, lime, amber, warm white, cool white
CHANNELS = ["395 nm", "420 nm", "Violet", "Royal Blue", "Blue", "Lime", "Amber", "Warm White", "Cool White"]
CHANNEL_KEYS = ["uv395", "uv420", "violet", "royal_blue", "blue", "lime", "amber", "warm_white", "cool_white"]
# Full-scale watts per channel, from the light's own ChConvert_W table (ModelType Uno2)
UNO2_WATTS = [36, 36, 36, 64.8, 57.6, 7.2, 9.36, 9.36, 9.36]

POINT_FIELDS = ["pindex", "hr", "min", "rate", "name", "master", "seasonal", "screen"]
NOW_TAIL = ["MoonRiseHr", "MoonRiseMin", "MoonSetHr", "MoonSetMin"]
NAME_MAX = 15

DEVICE_ACTIONS = {
    "demo": "/LightingModeDemo",
    "restart": "/restart",
    "recalibrate_fan": "/RecalibrateFan",
    "display_toggle": "/DisplayOnOff",
    "cooldown": "/cooldown",
    "led_start_test_on": "/EnableLEDStartTest",
    "led_start_test_off": "/DisableLEDStartTest",
}
