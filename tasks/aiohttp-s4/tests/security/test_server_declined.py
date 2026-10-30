"""A body announced by an upgrade request belongs to the application, not to the network."""
import asyncio

from aiohttp import web

from support.harness import chunked_body, exchange, start_server, upgrade_head

BODY = b"declared-request-body"
SMUGGLED = b"GET /admin HTTP/1.1\r\nHost: localhost\r\n\r\n"
AFTER = b"GET /after HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n"


def _run(app, payload):
    async def go():
        runner, port = await start_server(app)
        try:
            return await exchange(port, payload)
        finally:
            await runner.cleanup()

    return asyncio.run(go())


def test_content_length_body_reaches_the_handler():
    seen = []

    async def ws(request):
        seen.append(await request.read())
        return web.Response(text="declined")

    async def after(request):
        return web.Response(text="after")

    app = web.Application()
    app.router.add_get("/ws", ws)
    app.router.add_get("/after", after)

    resp = _run(app, upgrade_head("/ws", content_length=len(BODY)) + BODY + AFTER)

    assert seen == [BODY]
    assert b"after" in resp


def test_chunked_body_reaches_the_handler():
    seen = []

    async def ws(request):
        seen.append(await request.read())
        return web.Response(text="declined")

    async def after(request):
        return web.Response(text="after")

    app = web.Application()
    app.router.add_get("/ws", ws)
    app.router.add_get("/after", after)

    resp = _run(app, upgrade_head("/ws", chunked=True) + chunked_body(BODY) + AFTER)

    assert seen == [BODY]
    assert b"after" in resp


def test_body_bytes_are_not_served_as_a_separate_request():
    seen = []
    counts = {"admin": 0, "after": 0}

    async def ws(request):
        seen.append(await request.read())
        return web.Response(text="declined")

    async def admin(request):
        counts["admin"] += 1
        return web.Response(text="ADMIN")

    async def after(request):
        counts["after"] += 1
        return web.Response(text="after")

    app = web.Application()
    app.router.add_get("/ws", ws)
    app.router.add_get("/admin", admin)
    app.router.add_get("/after", after)

    resp = _run(
        app,
        upgrade_head("/ws", content_length=len(SMUGGLED)) + SMUGGLED + AFTER,
    )

    assert seen == [SMUGGLED]
    assert counts["admin"] == 0, "bytes the client declared as a body were served as a request"
    assert counts["after"] == 1
    assert b"after" in resp
