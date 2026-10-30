"""Ordinary traffic keeps working exactly as today."""
import asyncio

from aiohttp import web

from support.harness import (
    chunked_body,
    exchange,
    masked_frame,
    start_server,
    upgrade_head,
    websocket_session,
)

BODY = b"ordinary request body"


def _run(app, payload):
    async def go():
        runner, port = await start_server(app)
        try:
            return await exchange(port, payload)
        finally:
            await runner.cleanup()

    return asyncio.run(go())


def _echo_app():
    async def echo(request):
        body = await request.read()
        return web.Response(text=body.hex())

    app = web.Application()
    app.router.add_post("/echo", echo)
    return app


def test_ordinary_content_length_body_is_read():
    payload = (
        b"POST /echo HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n"
        b"Content-Length: %d\r\n\r\n" % len(BODY)
    ) + BODY
    resp = _run(_echo_app(), payload)
    assert BODY.hex().encode() in resp


def test_ordinary_chunked_body_is_read():
    payload = (
        b"POST /echo HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n"
        b"Transfer-Encoding: chunked\r\n\r\n" + chunked_body(BODY)
    )
    resp = _run(_echo_app(), payload)
    assert BODY.hex().encode() in resp


def test_pipelined_ordinary_requests_are_both_served():
    async def one(request):
        return web.Response(text="one")

    async def two(request):
        return web.Response(text="two")

    app = web.Application()
    app.router.add_get("/one", one)
    app.router.add_get("/two", two)
    payload = (
        b"GET /one HTTP/1.1\r\nHost: localhost\r\n\r\n"
        b"GET /two HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n"
    )
    resp = _run(app, payload)
    assert resp.count(b"HTTP/1.") == 2
    assert b"one" in resp and b"two" in resp


def test_websocket_handshake_without_a_body_still_works():
    received = []

    async def ws(request):
        response = web.WebSocketResponse()
        await response.prepare(request)
        async for msg in response:
            received.append(msg.data)
            await response.send_str("GOT:" + msg.data)
            break
        await response.close()
        return response

    app = web.Application()
    app.router.add_get("/ws", ws)

    async def go():
        runner, port = await start_server(app)
        try:
            return await websocket_session(
                port,
                upgrade_head("/ws"),
                masked_frame(b"PING"),
                b"",
                wait_for_response=True,
            )
        finally:
            await runner.cleanup()

    data = asyncio.run(go())
    assert b"101" in data
    assert b"GOT:PING" in data
