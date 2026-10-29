"""In-process harness for the hidden suites.

Every request goes through the product's real FastAPI application: the same routers,
dependencies and middleware that uvicorn serves.  The server start-up entry points are
driven as well (with only the blocking uvicorn call replaced), so whatever wiring a fix
adds at start-up is exercised exactly as the real CLI does it.

Nothing here computes an expected value from product code; the helpers only build the
real applications and record whether a mock agent was run.
"""
from __future__ import annotations

import contextlib
import importlib
import os
import tempfile

ENV_KEYS = (
    "CALL_SERVER_TOKEN",
    "PRAISONAI_CALL_AUTH",
    "PRAISONAI_CALL_BIND_HOST",
    "PRAISONAI_SERVE_AUTH",
    "OPENAI_API_KEY",
    "PUBLIC",
)

_AGENTS_YAML = """\
roles:
  helper:
    role: helper
    goal: answer questions
    backstory: a helper
"""


class RecordingAgent:
    """A stand-in for a registered agent; records whether it was run."""

    def __init__(self, name: str = "helper") -> None:
        self.name = name
        self.calls: list[str] = []

    def start(self, message: str) -> str:
        self.calls.append(message)
        return f"ok:{message}"


def reset_env(values: dict | None = None) -> None:
    for key in ENV_KEYS:
        os.environ.pop(key, None)
    os.environ["OPENAI_API_KEY"] = "sk-test"
    if values:
        os.environ.update(values)


def load_agent_module(values: dict):
    """Set the environment, then reload the auth module so it reads it."""
    reset_env(values)
    import praisonai.api.agent_invoke as agent_invoke

    return importlib.reload(agent_invoke)


def call_app(values: dict):
    """The telephony server's real ASGI app, built with `values` in the environment."""
    load_agent_module(values)
    import praisonai.api.call as call

    call = importlib.reload(call)
    return call, call.app


def start_call(values: dict, argv: list[str]):
    """Drive the telephony server's real CLI entry point, capturing the served app."""
    call, _ = call_app(values)
    import uvicorn

    captured: dict = {}
    real_run = uvicorn.run
    real_public = call.setup_public_url

    def fake_run(app, host=None, port=None, **kwargs):
        captured["app"] = app
        captured["host"] = host
        captured["kwargs"] = kwargs

    uvicorn.run = fake_run
    call.setup_public_url = lambda port: "https://tunnel.example.test"
    try:
        call.main(list(argv))
    finally:
        uvicorn.run = real_run
        call.setup_public_url = real_public
    if "app" not in captured:
        raise AssertionError("the server CLI did not reach uvicorn.run")
    return call, captured["app"], captured


def serve_app(values: dict, host: str, api_key: str | None = None, reload: bool = False):
    """Drive `serve agents`'s real CLI entry point, capturing the served app."""
    agent_invoke = load_agent_module(values)
    import praisonai.cli.features.serve as serve
    import uvicorn

    fd, agents_file = tempfile.mkstemp(prefix="agents-", suffix=".yaml")
    os.close(fd)
    with open(agents_file, "w", encoding="utf-8") as handle:
        handle.write(_AGENTS_YAML)

    captured: dict = {}
    real_run = uvicorn.run

    def fake_run(app, host=None, port=None, **kwargs):
        captured["app"] = app
        captured["host"] = host
        captured["kwargs"] = kwargs

    argv = ["agents", "--file", agents_file, "--host", host, "--port", "8765", "--path", "/agents"]
    if api_key:
        argv += ["--api-key", api_key]
    if reload:
        argv += ["--reload"]

    uvicorn.run = fake_run
    try:
        code = serve.ServeHandler().handle(argv)
    finally:
        uvicorn.run = real_run
    if "app" not in captured:
        raise AssertionError(f"`serve agents` did not reach uvicorn.run (exit {code})")
    return agent_invoke, captured["app"], captured


def register(agent_invoke, agent: RecordingAgent) -> RecordingAgent:
    agent_invoke.register_agent(agent.name, agent)
    return agent


def status_is_refusal(status_code: int) -> bool:
    """A refusal is any non-success response; the exact status is not fixed."""
    return status_code >= 400


@contextlib.contextmanager
def upstream_connector():
    """Replace the outbound realtime connector; records whether the stream started."""
    import websockets

    real = websockets.connect
    started: list = []

    class FakeSocket:
        open = True

        async def send(self, *args, **kwargs):
            return None

        async def close(self):
            return None

        def __aiter__(self):
            return self

        async def __anext__(self):
            raise StopAsyncIteration

    class FakeContext:
        async def __aenter__(self):
            return FakeSocket()

        async def __aexit__(self, *exc):
            return False

    def connect(*args, **kwargs):
        started.append((args, kwargs))
        return FakeContext()

    websockets.connect = connect
    try:
        yield started
    finally:
        websockets.connect = real
