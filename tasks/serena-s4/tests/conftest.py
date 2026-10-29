"""Fixtures shared by the hidden suites.

Every helper starts a real HTTP server through one of the product's own entry points and
speaks plain HTTP to it.  The tray icon needs a display, so the GUI boundary is replaced
by a stub; nothing else about the product is replaced.
"""
import http.client
import json
import socket
import sys
import threading
import time
import types

import pytest

# ---- boundary stub: the tray icon GUI (never exercised by these HTTP tests) -----------
if "pystray" not in sys.modules:
    _fake = types.ModuleType("pystray")

    class _Icon:
        def __init__(self, *args, **kwargs):
            pass

        def run(self):
            return None

        def stop(self):
            return None

        def update_menu(self):
            return None

    _fake.Icon = _Icon
    _fake.Menu = lambda *args, **kwargs: ()
    _fake.MenuItem = object
    sys.modules["pystray"] = _fake

from serena.dashboard import SerenaDashboardAPI  # noqa: E402
from serena.dashboard import SerenaDashboardTrayManager  # noqa: E402
from serena.dashboard_standalone import serve as serve_standalone  # noqa: E402


class MemoryLogHandler:
    """A log source the tests can inspect; no product code is used to compute expectations."""

    def __init__(self):
        self.messages = ["visible log line"]
        self.clear_count = 0

    def get_log_messages(self, from_idx: int = 0):
        return types.SimpleNamespace(messages=list(self.messages), max_idx=len(self.messages) - 1)

    def clear_log_messages(self):
        self.clear_count += 1
        self.messages = []


class AgentStub:
    """The dashboard's agent boundary: records the actions a request asks for."""

    def __init__(self):
        self.events = []

    def execute_task(self, func, *args, **kwargs):
        return func()

    def get_active_project(self):
        return None

    def get_current_tasks(self):
        return []

    def shutdown(self):
        self.events.append("shutdown")


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def wait_until_listening(port: int, timeout: float = 20.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), 0.2):
                return
        except OSError:
            time.sleep(0.05)
    raise AssertionError(f"no server started on port {port}")


def make_dashboard():
    handler = MemoryLogHandler()
    agent = AgentStub()
    api = SerenaDashboardAPI(memory_log_handler=handler, tool_names=["find_symbol"], agent=agent, tool_usage_stats=None)
    return api, handler, agent


def request(port: int, method: str, path: str, host: str, body=None):
    """One ordinary HTTP request to 127.0.0.1:port carrying the given authority."""
    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=10)
    try:
        conn.putrequest(method, path, skip_host=True, skip_accept_encoding=True)
        conn.putheader("Host", host)
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            conn.putheader("Content-Type", "application/json")
            conn.putheader("Content-Length", str(len(data)))
        conn.endheaders(data)
        response = conn.getresponse()
        payload = response.read()
        return response.status, payload
    finally:
        conn.close()


def refused(status: int) -> bool:
    """A refusal is any client error, whatever the fix chose to return."""
    return 400 <= status < 500


class Server:
    def __init__(self, port, handler, agent, kind):
        self.port = port
        self.handler = handler
        self.agent = agent
        self.kind = kind

    def get(self, path, host, **kwargs):
        return request(self.port, "GET", path, host, **kwargs)

    def post(self, path, host, body=None):
        return request(self.port, "POST", path, host, body)

    def put(self, path, host, body=None):
        return request(self.port, "PUT", path, host, body)


def start(target, port: int) -> None:
    threading.Thread(target=target, daemon=True).start()
    wait_until_listening(port)


@pytest.fixture
def dashboard():
    """The dashboard API served by its own public entry point."""
    api, handler, agent = make_dashboard()
    port = free_port()
    start(lambda: api.run("127.0.0.1", port), port)
    return Server(port, handler, agent, "dashboard")


@pytest.fixture
def standalone():
    """The dashboard served through the standalone WSGI entry point."""
    api, handler, agent = make_dashboard()
    port = free_port()
    start(lambda: serve_standalone(api, "127.0.0.1", port), port)
    return Server(port, handler, agent, "standalone")


@pytest.fixture(scope="session")
def tray():
    """The tray manager's HTTP service, started by its own public entry point."""
    manager = SerenaDashboardTrayManager()
    port = SerenaDashboardTrayManager.PORT
    threading.Thread(target=manager.run, daemon=True).start()
    wait_until_listening(port)
    server = Server(port, None, None, "tray")
    server.manager = manager
    return server


def register_body(port: int, **overrides):
    body = {
        "port": port,
        "pid": __import__("os").getpid(),
        "dashboard_url": f"http://localhost:{port}/dashboard/index.html",
        "project": "sample",
        "started_at": "2026-01-01T00:00:00Z",
    }
    body.update(overrides)
    return body
