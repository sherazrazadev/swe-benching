"""Small raw-HTTP client used by the hidden suites.

The suites talk to a real ASGI server over a loopback socket, not to an in-process test
transport: the flaw under test is about what a request carries on the wire (a missing Host
header, or an authority that is not a plain host[:port]), so the app has to be driven the way
a socket client drives it.
"""
from __future__ import annotations

import socket
import threading
import time
from dataclasses import dataclass, field

import uvicorn


@dataclass
class Response:
    status: int
    headers: dict[str, str] = field(default_factory=dict)
    body: bytes = b""

    @property
    def text(self) -> str:
        return self.body.decode("latin-1", errors="replace")

    def json(self):
        import json

        return json.loads(self.body)

    def header(self, name: str) -> str | None:
        return self.headers.get(name.lower())


def _dechunk(data: bytes) -> bytes:
    out = []
    rest = data
    while rest:
        line, sep, rest = rest.partition(b"\r\n")
        if not sep:
            break
        try:
            size = int(line.split(b";", 1)[0].strip() or b"0", 16)
        except ValueError:
            return data
        if size == 0:
            break
        out.append(rest[:size])
        rest = rest[size + 2 :]
    return b"".join(out)


def _parse(raw: bytes) -> Response:
    head, sep, body = raw.partition(b"\r\n\r\n")
    if not sep:
        return Response(status=0, body=raw)
    lines = head.decode("latin-1", errors="replace").split("\r\n")
    parts = lines[0].split()
    status = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0
    headers: dict[str, str] = {}
    for line in lines[1:]:
        name, colon, value = line.partition(":")
        if colon:
            headers.setdefault(name.strip().lower(), value.strip())
    if headers.get("transfer-encoding", "").lower() == "chunked":
        body = _dechunk(body)
    return Response(status=status, headers=headers, body=body)


class LiveServer:
    """Run a Litestar app under uvicorn on an ephemeral loopback port."""

    def __init__(self, app) -> None:
        self._app = app
        self._server = None
        self._thread = None
        self.port = 0

    def __enter__(self) -> "LiveServer":
        config = uvicorn.Config(
            self._app,
            host="127.0.0.1",
            port=0,
            log_level="critical",
            access_log=False,
            lifespan="off",
        )
        self._server = uvicorn.Server(config)
        self._thread = threading.Thread(target=self._server.run, daemon=True)
        self._thread.start()
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            if self._server.started:
                break
            time.sleep(0.01)
        else:  # pragma: no cover - startup failure is an environment fault
            raise RuntimeError("the test server did not start")
        self.port = self._server.servers[0].sockets[0].getsockname()[1]
        return self

    def __exit__(self, *_exc) -> None:
        if self._server is not None:
            self._server.should_exit = True
        if self._thread is not None:
            self._thread.join(timeout=10)

    def request(
        self,
        method: str = "GET",
        target: str = "/",
        *,
        host: str | None = "localhost",
        headers: dict[str, str] | None = None,
        version: str = "HTTP/1.1",
        body: bytes = b"",
    ) -> Response:
        """Send one HTTP request. ``host=None`` sends no Host header at all."""
        lines = [f"{method} {target} {version}"]
        if host is not None:
            lines.append(f"Host: {host}")
        for name, value in (headers or {}).items():
            lines.append(f"{name}: {value}")
        if body:
            lines.append(f"Content-Length: {len(body)}")
        lines.append("Connection: close")
        request = ("\r\n".join(lines) + "\r\n\r\n").encode("latin-1") + body

        sock = socket.create_connection(("127.0.0.1", self.port), timeout=20)
        try:
            sock.sendall(request)
            chunks = []
            while True:
                chunk = sock.recv(65536)
                if not chunk:
                    break
                chunks.append(chunk)
        finally:
            sock.close()
        return _parse(b"".join(chunks))


def serve(app) -> LiveServer:
    return LiveServer(app)
