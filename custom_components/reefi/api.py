"""Local HTTP/WebSocket client for a ReeFi LED light (firmware 5.x)."""
from __future__ import annotations

import asyncio
from urllib.parse import quote

import aiohttp
from yarl import URL

TIMEOUT = aiohttp.ClientTimeout(total=10)
# Same characters JavaScript's encodeURIComponent leaves alone
JS_SAFE = "-_.!~*'()"


class ReefiError(Exception):
    """Raised when the light can't be reached or answers badly."""


def parse_cfg(text: str) -> list[list[str]]:
    """Parse 'k=v,k=v' into an ordered list of [key, value]."""
    out: list[list[str]] = []
    for part in text.strip().strip(",").split(","):
        if "=" not in part:
            continue
        key, _, val = part.partition("=")
        out.append([key.strip(), val])
    if not out:
        raise ReefiError("Empty or unreadable response")
    return out


def form_args(items: list[list[str]]) -> str:
    """Rebuild the web UI's getFormArgs() string: '&k=v&k=v'."""
    return "".join(f"&{k}={v}" for k, v in items)


class ReefiApi:
    def __init__(self, session: aiohttp.ClientSession, host: str) -> None:
        self._session = session
        self.host = host.strip().removeprefix("http://").rstrip("/")
        self._lock = asyncio.Lock()

    @property
    def base(self) -> str:
        return f"http://{self.host}"

    async def _get(self, path_and_query: str, encoded: bool = False) -> str:
        url = URL(self.base + path_and_query, encoded=encoded)
        try:
            async with self._lock:
                async with self._session.get(url, timeout=TIMEOUT) as resp:
                    if resp.status != 200:
                        raise ReefiError(f"{path_and_query.split('?')[0]} returned HTTP {resp.status}")
                    return await resp.text(errors="replace")
        except (aiohttp.ClientError, asyncio.TimeoutError) as err:
            raise ReefiError(f"Can't reach the light at {self.host}: {err}") from err

    async def get_cfg(self, name: str) -> list[list[str]]:
        return parse_cfg(await self._get(f"/{name}"))

    async def get_host_info(self) -> dict[str, str]:
        parts = (await self._get("/GetHostIP")).strip().split(";")
        if len(parts) < 4:
            raise ReefiError("Unexpected /GetHostIP reply")
        return {"hostname": parts[0], "mac": parts[2], "ip": parts[3]}

    async def save(self, settings: list[list[str]], profiles: list[list[str]], now_tail: list[list[str]]) -> None:
        """Same request the web UI's 'Save to Unit' sends: full form, URI-encoded as one blob."""
        payload = form_args(settings) + form_args(profiles) + form_args(now_tail) + "&DeleteMode=-1"
        await self._get("/Lrequests?NoUpdate=Save" + quote(payload, safe=JS_SAFE), encoded=True)

    async def send_now(self, now_items: list[list[str]]) -> None:
        """Live levels over the light's WebSocket, as the web UI's SendNow() does."""
        text = ",".join(f"{k}={v}" for k, v in now_items if k != "cMode")
        try:
            async with self._session.ws_connect(f"ws://{self.host}/ws", timeout=aiohttp.ClientWSTimeout(ws_close=5)) as ws:
                await ws.send_str(text)
                await asyncio.sleep(0.5)
        except (aiohttp.ClientError, asyncio.TimeoutError) as err:
            raise ReefiError(f"WebSocket to {self.host} failed: {err}") from err

    async def resume(self) -> None:
        await self._get("/resume.txt")

    async def action(self, path: str) -> None:
        await self._get(path)

    async def query(self, path: str, params: list[tuple[str, str]]) -> None:
        q = "&".join(f"{k}={quote(str(v), safe='-_.:')}" for k, v in params)
        await self._get(f"{path}?{q}", encoded=True)
