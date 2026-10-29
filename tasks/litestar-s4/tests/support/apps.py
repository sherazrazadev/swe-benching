"""Litestar applications used by the hidden suites.

Every app is built through the framework's public constructor, exactly as a downstream user
would build one; the suites drive it over a real socket (see ``hostclient``).
"""
from __future__ import annotations

from litestar import Litestar, Request, get
from litestar.config.allowed_hosts import AllowedHostsConfig

SERVED_MARKER = "handler-ran"


def make_app(allowed_hosts, **config_kwargs) -> Litestar:
    @get("/", sync_to_thread=False)
    def index() -> dict:
        return {"served": SERVED_MARKER}

    @get("/echo-url", sync_to_thread=False)
    def echo_url(request: Request) -> dict:
        return {"url": str(request.url), "base_url": str(request.base_url)}

    config = AllowedHostsConfig(allowed_hosts=list(allowed_hosts), **config_kwargs)
    return Litestar(route_handlers=[index, echo_url], allowed_hosts=config, logging_config=None)
