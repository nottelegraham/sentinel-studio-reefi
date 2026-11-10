# ReeFi Uno 2.x Pro — local protocol (firmware 5.43)

Worked out from the light's own web UI, November 2026.

## Reading
Plain HTTP GET, body is comma-separated `key=value`:
- `/now.cfg` — live state: `nowch0..nowch8` (0–1023), `cMoon`, `chr`/`cmin` (light's clock), `cCloud`, `cMode` (current point name), `Ver`, `MoonRiseHr/Min`, `MoonSetHr/Min`
- `/settings3.cfg` — schedule + settings: 20 points `mN_name, mN_hr, mN_min, mN_rate, mN_pindex, mN_master, mN_seasonal, mN_screen`; `VM` = number of active points; plus `Lat, Long, TZ, ADLS, SelectedDLS, MaxCloud, AccPercent, AccDays, EnMoon, SelMoonType, FanMode, MMSetDelay, ModelType`, seasonal fields
- `/profiles.cfg` — 20 profiles `pN_name`, `pN_chK` (0–1023), `pN_cfK`
- also: `/settings_all.cfg`, `/gleds.txt` (groups), `/resume.txt`, `/GetHostIP` → `host;host;MAC;IP`

## Writing
- **Save schedule/profiles/settings** (`save_refresh`): `GET /Lrequests?NoUpdate=Save` + `encodeURIComponent("&name=value&…")` built from every field of the main form (all `m*`, `p*`, settings), then `&MoonRiseHr…` fields from the Now form, then `&DeleteMode=-1`. Send the full set, not a delta.
- **Live channel levels** (`SendNow`): WebSocket `ws://<host>/ws`, send text `nowch0=…,nowch1=…,…` (Now-form fields joined with commas). The page shows a manual timer (`MMSetDelay`, minutes) before the schedule resumes.
- Other GET endpoints seen: `/LightingModeDemo`, `/DisplayOnOff`, `/restart`, `/RecalibrateFan`, `/SaveDateTime?`, `/SaveSolMins?`, `/SavePwrCheck?`, `/SetHostName?HostName=`, `/DB_Get`, `/DB_Save`, `/upload` (POST), `/firmware`, `/reset_default*` (do not call).

## Channel order (cfg index)
0 = 395 nm, 1 = 420 nm, 2 = Violet, 3 = Royal Blue, 4 = Blue, 5 = Lime, 6 = Amber, 7 = Warm White, 8 = Cool White.
The web UI lists sliders in the reverse order (Cool first).

## Power (ChConvert_W, ModelType Uno2)
Full-scale watts per channel: 36, 36, 36, 64.8, 57.6, 7.2, 9.36, 9.36, 9.36 (sum 265.7 W).
W = Σ level_k / 1023 × fullscale_k. Matches the UI: Blue profile × 90% = 95 W, Day JG × 50% = 110 W.

## Schedule curve
The UI chart interpolates linearly between consecutive active points and wraps midnight. `rate` (minutes) is stored per point.
