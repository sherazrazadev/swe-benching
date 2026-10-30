"""Bytes of an announced body must never surface as messages of the new protocol."""
import asyncio

from aiohttp import web

from support.harness import (
    masked_frame,
    start_server,
    upgrade_head,
    websocket_session,
)

INJECT_MARK = "INJECTED"
REAL_FRAME = masked_frame(b"REAL")
INJECT_FRAME = masked_frame(INJECT_MARK.encode())


def _app(received):
    async def ws(request):
        response = web.WebSocketResponse()
        await response.prepare(request)
        try:
            async for msg in response:
                received.append(msg.data)
                if len(received) >= 2:
                    break
        except Exception:
            pass
        return response

    app = web.Application()
    app.router.add_get("/ws", ws)
    return app


def _run(app, head, body, after, wait_for_response):
    async def go():
        runner, port = await start_server(app)
        try:
            await websocket_session(port, head, body, after, wait_for_response)
        finally:
            await runner.cleanup()

    asyncio.run(go())


def test_body_in_the_same_packet_is_not_a_protocol_message():
    received = []
    _run(
        _app(received),
        upgrade_head("/ws", content_length=len(INJECT_FRAME)),
        INJECT_FRAME,
        REAL_FRAME,
        wait_for_response=False,
    )
    assert INJECT_MARK not in received


def test_body_arriving_after_the_switch_is_not_a_protocol_message():
    received = []
    _run(
        _app(received),
        upgrade_head("/ws", content_length=len(INJECT_FRAME)),
        INJECT_FRAME,
        REAL_FRAME,
        wait_for_response=True,
    )
    assert INJECT_MARK not in received
