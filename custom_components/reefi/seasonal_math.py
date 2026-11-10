"""Pure seasonal math (no Home Assistant imports) so it can be tested on its own."""
from __future__ import annotations

import math
from datetime import date, timedelta

# Default seasonal table, GHL Connect style: [MM-DD, brightness %, duration %]
GHL_TABLE = [
    ["01-04", 66, 78], ["01-19", 68, 79], ["02-04", 70, 81], ["02-19", 74, 83],
    ["03-06", 78, 86], ["03-21", 82, 88], ["04-05", 87, 91], ["04-21", 91, 94],
    ["05-06", 94, 96], ["05-21", 97, 98], ["06-05", 99, 99], ["06-21", 100, 100],
    ["07-06", 99, 99], ["07-21", 97, 98], ["08-05", 95, 96], ["08-20", 91, 94],
    ["09-05", 87, 91], ["09-20", 83, 89], ["10-05", 78, 86], ["10-20", 74, 83],
    ["11-04", 70, 81], ["11-20", 68, 79], ["12-05", 66, 78], ["12-20", 66, 78]]
MODES = ("both", "time", "fixed")


def doy(mmdd: str) -> int:
    m, d = (int(x) for x in mmdd.split("-"))
    return (date(2001, m, d) - date(2001, 1, 1)).days  # 0..364, non-leap


def factors(table: list, day: date) -> tuple[float, float]:
    """Linear interpolation between table rows, wrapping Dec -> Jan."""
    rows = sorted(([doy(r[0]), float(r[1]), float(r[2])] for r in table), key=lambda r: r[0])
    if not rows:
        return 100.0, 100.0
    t = min(364, (day - date(day.year, 1, 1)).days)
    before = [r for r in rows if r[0] <= t]
    after = [r for r in rows if r[0] > t]
    a = before[-1] if before else rows[-1]
    b = after[0] if after else rows[0]
    span = (b[0] - a[0]) % 365 or 365
    f = ((t - a[0]) % 365) / span
    return a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f


def autofill(longest: str, min_brightness: float, min_duration: float) -> list:
    """GHL Connect fillTableAutomatically(): 24 rows from the longest day, 365/24 days apart."""
    e, out = float(doy(longest)), []
    for a in range(24):
        d = date(2001, 1, 1) + timedelta(days=math.trunc(e))
        c = (math.cos(a / 24 * 6.28) + 1) / 2
        out.append([d.strftime("%m-%d"), math.trunc(c * (100 - min_brightness) + min_brightness),
                    math.trunc(c * (100 - min_duration) + min_duration)])
        e += 365 / 24
        if e >= 365:
            e -= 365
    return sorted(out, key=lambda r: doy(r[0]))


def minutes(hhmm: str) -> int:
    h, m = (int(x) for x in hhmm.split(":"))
    return h * 60 + m


def transform(base: list[dict], modes: dict, midday: int, brightness: float, duration: float) -> list[dict]:
    """Squeeze point times toward midday by duration %, scale intensity by brightness %."""
    out = []
    for p in base:
        mode = modes.get(str(p["index"]), "both")
        t, m = p["hr"] * 60 + p["min"], p["master"]
        if mode in ("both", "time"):
            t = max(0, min(1439, round(midday + (t - midday) * duration / 100)))
        if mode == "both":
            m = max(0, min(100, round(m * brightness / 100)))
        out.append({"index": p["index"], "name": p.get("name", ""), "hr": t // 60, "min": t % 60, "master": m})
    # keep the base order and one minute between points
    last = -1
    for i in sorted(range(len(base)), key=lambda i: base[i]["hr"] * 60 + base[i]["min"]):
        t = out[i]["hr"] * 60 + out[i]["min"]
        if t <= last:
            t = min(1439, last + 1)
        out[i]["hr"], out[i]["min"] = divmod(t, 60)
        last = t
    return out


def inverse(point: dict, mode: str, midday: int, brightness: float, duration: float) -> dict:
    """Map a point edited in today's schedule back to the longest-day base."""
    t, m = point["hr"] * 60 + point["min"], point["master"]
    if mode in ("both", "time") and duration > 0:
        t = max(0, min(1439, round(midday + (t - midday) * 100 / duration)))
    if mode == "both" and brightness > 0:
        m = max(0, min(100, round(m * 100 / brightness)))
    return {"hr": t // 60, "min": t % 60, "master": m}
