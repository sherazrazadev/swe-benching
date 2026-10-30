"""Helpers shared by the origin tests.

The tests drive the real ASGI application (the same routes the product registers),
with the outbound WebSocket dial instrumented so a test can tell whether the proxy
opened a provider session. Nothing here computes an expected policy value from
product code: the expected outcomes are written into the tests.
"""

import websockets
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from headroom.proxy.server import ProxyConfig, create_app

# A port that refuses connections immediately, so nothing ever leaves the machine.
UPSTREAM = "http://127.0.0.1:9"


class Proxy:
    """A real proxy app plus a recorder for outbound WebSocket dials."""

    def __init__(self, monkeypatch, env=None):
        # The default policy applies only when no explicit configuration is present.
        monkeypatch.delenv("HEADROOM_WS_ORIGINS", raising=False)
        monkeypatch.delenv("HEADROOM_CORS_ORIGINS", raising=False)
        for key, value in (env or {}).items():
            monkeypatch.setenv(key, value)

        self.dials = []

        async def connect(*args, **kwargs):
            self.dials.append((args, kwargs))
            raise ConnectionError("stub upstream")

        # Any `import websockets` resolves to this module object.
        monkeypatch.setattr(websockets, "connect", connect)

        self.app = create_app(
            ProxyConfig(
                optimize=False,
                cache_enabled=False,
                rate_limit_enabled=False,
                openai_api_url=UPSTREAM,
                retry_max_attempts=1,
            )
        )
        self.client = TestClient(self.app)

    def outcome(self, path, origin=None, host=None):
        """Drive one upgrade. Returns "accepted" or "refused"."""
        headers = {"authorization": "Bearer sk-test"}
        if origin is not None:
            headers["origin"] = origin
        if host is not None:
            headers["host"] = host
        self.dials.clear()
        try:
            with self.client.websocket_connect(path, headers=headers):
                return "accepted"
        except WebSocketDisconnect:
            return "refused"

    @property
    def dialed(self):
        return len(self.dials)
