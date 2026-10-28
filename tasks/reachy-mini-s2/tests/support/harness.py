"""Shared harness for the hidden suites.

Everything here uses only the standard library, the HTTP test client, and the
product's public entry points.  Expected values (audio bytes, archive bytes)
are built in the tests themselves, never with product helpers.
"""

from __future__ import annotations

import asyncio
import base64
import io
import json
import os
import shutil
import struct
import tempfile
import wave
import zipfile
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Iterator

import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient

SOUNDS_DIR = "/tmp/reachy_mini_sounds"
DEFAULT_AUDIO_ROOT = "/tmp/reachy-mini-uploads"
FIXTURES = Path(__file__).with_name("fixtures")
_PROBE_MARKER = b"# reachy-s2 probe payload\n"


def wav_bytes(samples: int = 800, rate: int = 8000) -> bytes:
    """Return a genuine mono PCM WAV of *samples* frames of silence."""
    raw = io.BytesIO()
    with wave.open(raw, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"\x00\x00" * samples)
    return raw.getvalue()


def large_wav_bytes(min_bytes: int) -> bytes:
    """Return a genuine WAV whose encoded size is at least *min_bytes*."""
    # 16-bit mono at 8 kHz: 16000 bytes per second.
    seconds = (min_bytes // 16000) + 2
    return wav_bytes(samples=seconds * 8000)


def fixture_bytes(name: str) -> bytes:
    """Return the bytes of a small genuine audio fixture."""
    return (FIXTURES / name).read_bytes()


def marker_bytes() -> bytes:
    """Return a non-audio payload carrying a unique marker."""
    return _PROBE_MARKER


def zip_bytes(members: list[tuple[str, bytes]]) -> bytes:
    """Return a zip archive built from ``(name, data)`` pairs."""
    raw = io.BytesIO()
    with zipfile.ZipFile(raw, "w") as archive:
        for name, data in members:
            archive.writestr(name, data)
    return raw.getvalue()


def fresh_sounds_dir() -> str:
    """Remove and recreate the daemon sound directory; return its path."""
    shutil.rmtree(SOUNDS_DIR, ignore_errors=True)
    return SOUNDS_DIR


def sounds_files() -> list[str]:
    """Return the regular files currently in the sound directory."""
    if not os.path.isdir(SOUNDS_DIR):
        return []
    return sorted(os.listdir(SOUNDS_DIR))


def read_sound(name: str) -> bytes:
    """Return the content of a stored sound file."""
    return Path(SOUNDS_DIR, name).read_bytes()


def full_app() -> FastAPI:
    """Build the daemon's real application, without starting the hardware."""
    from reachy_mini.daemon.app.main import Args, create_app

    return create_app(
        Args(autostart=False, dataset_update_interval_hours=0, no_media=True)
    )


def client(app: FastAPI) -> TestClient:
    """Return a synchronous HTTP client for *app*."""
    return TestClient(app, raise_server_exceptions=False)


def is_client_error(response: httpx.Response) -> bool:
    """Whether *response* is a client error status."""
    return 400 <= response.status_code < 500


def strong_assert_client_error(response: httpx.Response) -> None:
    """Fail unless the request was refused with a client error."""
    assert is_client_error(response), (
        f"expected a client error, got {response.status_code}: {response.text[:200]}"
    )


def files_containing(root: str | Path, needle: bytes) -> list[str]:
    """Return files under *root* whose content contains *needle*."""
    found: list[str] = []
    root = Path(root)
    if not root.exists():
        return found
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        try:
            data = path.read_bytes()
        except OSError:
            continue
        if needle in data:
            found.append(str(path))
    return found


def all_regular_files(root: str | Path) -> list[str]:
    """Return every regular file under *root*."""
    root = Path(root)
    if not root.exists():
        return []
    return sorted(str(p) for p in root.rglob("*") if p.is_file())


@contextmanager
def private_temp_root() -> Iterator[str]:
    """Point the standard-library temp directory at a private root."""
    root = tempfile.mkdtemp(prefix="reachy-upload-")
    previous = tempfile.tempdir
    tempfile.tempdir = root
    try:
        yield root
    finally:
        tempfile.tempdir = previous
        shutil.rmtree(root, ignore_errors=True)


def _backend(root: str):
    from reachy_mini.daemon.backend.abstract import Backend

    return Backend(use_audio=False)


def _command_channel(backend):
    """Return a TestClient for the real SDK websocket route."""
    from reachy_mini.daemon.app.routers import sdk_ws
    from reachy_mini.io.ws_server import WSServer

    app = FastAPI()
    app.include_router(sdk_ws.router)
    app.state.daemon = SimpleNamespace(ws_server=WSServer(backend))
    return TestClient(app)


def audio_messages(upload_id: str, data: bytes, chunk_chars: int = 16 * 1024):
    """Yield the protocol messages that upload *data* to a command channel."""
    payload = base64.b64encode(data).decode()
    chunks = [payload[i : i + chunk_chars] for i in range(0, len(payload), chunk_chars)]
    yield {
        "type": "upload_audio_start",
        "upload_id": upload_id,
        "total_chunks": len(chunks),
    }
    for index, chunk in enumerate(chunks):
        yield {
            "type": "upload_audio_chunk",
            "upload_id": upload_id,
            "chunk_index": index,
            "chunk": chunk,
        }
    yield {"type": "upload_audio_finish", "upload_id": upload_id}


def run_sdk_audio(upload_id: str, data: bytes) -> None:
    """Upload *data* through the real SDK websocket route.

    The caller must hold :func:`private_temp_root` open so the daemon's
    upload area lands there.
    """
    backend = _backend(tempfile.gettempdir())
    with _command_channel(backend).websocket_connect("/ws/sdk") as socket:
        for message in audio_messages(upload_id, data):
            socket.send_text(json.dumps(message))


def run_webrtc_audio(upload_id: str, data: bytes) -> None:
    """Upload *data* through the WebRTC data-channel command handler.

    The caller must hold :func:`private_temp_root` open.
    """
    backend = _backend(tempfile.gettempdir())
    for message in audio_messages(upload_id, data):
        backend._handle_webrtc_message("peer-1", json.dumps(message))


def stored_anywhere(roots: list[str | Path], needle: bytes) -> list[str]:
    """Return matching files under any root, and under the default audio root."""
    found: list[str] = []
    for root in list(roots) + [DEFAULT_AUDIO_ROOT]:
        found.extend(files_containing(root, needle))
    return found


def all_stored_anywhere(roots: list[str | Path]) -> list[str]:
    """Return every file under any root, and under the default audio root."""
    found: list[str] = []
    for root in list(roots) + [DEFAULT_AUDIO_ROOT]:
        found.extend(all_regular_files(root))
    return found


async def streaming_multipart(filename: str, size: int, *, bound: str = "B"):
    """Yield one multipart body holding a genuine WAV of *size* PCM bytes.

    The request carries no honest length, so only a streaming check can
    notice that the body is over the limit.
    """
    header = (
        b"RIFF"
        + struct.pack("<I", 36 + size)
        + b"WAVEfmt "
        + struct.pack("<IHHIIHH", 16, 1, 1, 8000, 16000, 2, 16)
        + b"data"
        + struct.pack("<I", size)
    )
    yield (
        f'--{bound}\r\nContent-Disposition: form-data; name="file"; '
        f'filename="{filename}"\r\nContent-Type: audio/wav\r\n\r\n'
    ).encode()
    yield header
    remaining = size
    while remaining > 0:
        step = min(remaining, 1 << 20)
        yield b"\x00" * step
        remaining -= step
    yield f"\r\n--{bound}--\r\n".encode()


def post_streaming(app: FastAPI, path: str, filename: str, size: int,
                   declared_length: int | None = None) -> httpx.Response:
    """Post a multipart body without an honest Content-Length."""

    async def run() -> httpx.Response:
        headers = {"content-type": "multipart/form-data; boundary=B"}
        if declared_length is not None:
            headers["content-length"] = str(declared_length)
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://daemon") as ac:
            return await ac.post(
                path,
                content=streaming_multipart(filename, size),
                headers=headers,
            )

    return asyncio.run(run())


def json_response(response: httpx.Response) -> Any:
    """Return a response's JSON body."""
    return response.json()
