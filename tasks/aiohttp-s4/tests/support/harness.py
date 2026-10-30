"""Shared helpers for the hidden suites.

Everything here is bookkeeping (servers, raw sockets, frame encoding). Expected
values live in the tests themselves as literal bytes.
"""
import asyncio
from contextlib import suppress

from aiohttp import web

WS_KEY = "dGhlIHNhbXBsZSBub25jZQ=="
IDLE = 0.5


async def start_server(app):
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "127.0.0.1", 0)
    await site.start()
    port = site._server.sockets[0].getsockname()[1]
    return runner, port


async def read_available(reader, idle=IDLE, max_rounds=20):
    """Read until EOF or until the peer is idle for `idle` seconds."""
    data = b""
    for _ in range(max_rounds):
        try:
            chunk = await asyncio.wait_for(reader.read(65536), idle)
        except asyncio.TimeoutError:
            break
        if not chunk:
            break
        data += chunk
    return data


async def exchange(port, payload, idle=IDLE):
    reader, writer = await asyncio.open_connection("127.0.0.1", port)
    try:
        writer.write(payload)
        await writer.drain()
        return await read_available(reader, idle)
    finally:
        writer.close()
        with suppress(ConnectionResetError, BrokenPipeError):
            await writer.wait_closed()


def upgrade_head(path, content_length=None, chunked=False, upgrade="websocket"):
    lines = [
        f"GET {path} HTTP/1.1",
        "Host: localhost",
        "Connection: Upgrade",
        f"Upgrade: {upgrade}",
        f"Sec-WebSocket-Version: 13",
        f"Sec-WebSocket-Key: {WS_KEY}",
    ]
    if chunked:
        lines.append("Transfer-Encoding: chunked")
    elif content_length is not None:
        lines.append(f"Content-Length: {content_length}")
    return ("\r\n".join(lines) + "\r\n\r\n").encode()


def chunked_body(body):
    return b"%x\r\n%s\r\n0\r\n\r\n" % (len(body), body)


def masked_frame(payload, opcode=0x1):
    """A client-to-server WebSocket frame carrying `payload`."""
    mask = b"\x37\xfa\x21\x3d"
    data = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
    if len(payload) < 126:
        header = bytes([0x80 | opcode, 0x80 | len(payload)])
    else:
        header = bytes([0x80 | opcode, 0x80 | 126]) + len(payload).to_bytes(2, "big")
    return header + mask + data


async def websocket_session(port, head, body=b"", after=b"", wait_for_response=True):
    """Open a raw connection, send an upgrade head, optionally wait for the
    server's response before sending `body + after`, then let the peer idle.

    Returns the bytes the server sent before the session was closed.
    """
    reader, writer = await asyncio.open_connection("127.0.0.1", port)
    try:
        writer.write(head)
        await writer.drain()
        first = b""
        if wait_for_response:
            with suppress(asyncio.TimeoutError):
                first = await asyncio.wait_for(reader.read(4096), 1.0)
        if body or after:
            writer.write(body + after)
            await writer.drain()
        rest = await read_available(reader, idle=0.6, max_rounds=3)
        return first + rest
    finally:
        writer.close()
        with suppress(ConnectionResetError, BrokenPipeError):
            await writer.wait_closed()
