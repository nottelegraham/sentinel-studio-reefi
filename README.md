# Sentinel Studio for ReeFi

Local control of a ReeFi Uno 2.x Pro LED from Home Assistant: a custom integration (`reefi`) plus the Sentinel Studio dashboard card. Everything runs on your network; nothing goes to the cloud.

Not made by or affiliated with ReeFi. Tested against firmware 5.43.

[![Open your Home Assistant instance and open this repository in HACS.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=nottelegraham&repository=sentinel-studio-reefi&category=integration)

## Install

### HACS
1. Click the button above, or in HACS open the menu (⋮) → **Custom repositories**, add `https://github.com/nottelegraham/sentinel-studio-reefi`, type **Integration**.
2. Download **Sentinel Studio for ReeFi**, then restart Home Assistant.
3. Settings → Devices & services → Add integration → **Sentinel Studio for ReeFi**. Enter the light's IP address.

### Manual
Copy `custom_components/reefi` into `/config/custom_components/`, restart, then add the integration as in step 3.

## Add the card
Make a new dashboard (or view), set the view type to **Panel (single card)**, add a card, choose **Manual**, and paste:

```yaml
type: custom:reefi-studio-card
```

The integration serves the card itself; there is no resource to add. If the card shows "Custom element doesn't exist", hard-refresh the browser.

## First test, in this order
1. **Watch**: the Today tab should show live watts matching the light's own page.
2. **Quick look**: tap Maintenance, then Resume schedule.
3. **One small save**: rename one point, Send to light, then open the light's own web page and confirm the name changed and nothing else did. Saving sends the full settings set exactly as the light's own Save to Unit button does.

## What it adds
- Sensors: power (W), channel average, mode, moon illumination, and one per channel (%).
- Actions: `reefi.save_schedule`, `reefi.quick_look`, `reefi.resume_schedule`, `reefi.sync_clock`, `reefi.set_seasonal`, `reefi.set_power_check`, `reefi.device_action` (demo, restart, recalibrate_fan, display_toggle, cooldown, LED start test), `reefi.set_point_label`.
- Card tabs: Today (live output, quick looks, light curve, point editor, daily totals), Profiles, Settings (checks, simulation, date/time, seasonal, power outage check, system tools, links to the light's firmware and Wi-Fi pages).

## Seasons
GHL-style seasonal lighting run by Home Assistant. The light's own seasonal feature only shifts sunrise and sunset; this also scales brightness.
- Table: 24 dates, brightness 66–100 %, day length 78–100 %, editable, with autofill.
- Each day at 12:05 AM, Home Assistant interpolates today's values, squeezes point times toward midday (default 3:50 PM) by the day-length %, scales intensity by the brightness %, and saves to the light only if something changed.
- Turning it on stores the light's current schedule as the longest day (June 21). Per-point modes: time and brightness, time only, fixed (Moon defaults to fixed).
- Schedule edits made while Seasons is on are stored as longest-day values.
- Actions: `reefi.seasonal_configure`, `reefi.seasonal_capture_base`, `reefi.seasonal_apply`. Settings live in Home Assistant's storage, not on the light.

## Limits
- Firmware update, Wi-Fi setup, group setup and factory profile restore open the light's own pages. They are not rebuilt here.
- Point and profile names are limited to 15 characters; commas, `=` and `&` are removed because they break the light's settings format.
- Quick looks longer than the light's manual timer are held by re-sending the levels every 4 minutes.

Protocol notes: [PROTOCOL.md](PROTOCOL.md).

Part of the TelegrahamTested Sentinel tools.
