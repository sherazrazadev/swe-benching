"""No-body switches, zero-length bodies and unsupported tokens keep working."""
import asyncio

from aiohttp.http_parser import HttpRequestParserPy as Parser

from support.harness import upgrade_head
from support.parsers import make_request_parser


def test_upgrade_without_a_body_switches_immediately():
    async def go():
        parser = make_request_parser(Parser)
        messages, upgraded, tail = parser.feed_data(
            upgrade_head("/ws") + b"some raw data"
        )
        assert len(messages) == 1
        assert messages[0][0].upgrade is True
        assert upgraded is True
        assert tail == b"some raw data"
        assert await asyncio.wait_for(messages[0][1].read(), 2) == b""

    asyncio.run(go())


def test_zero_length_body_switches_immediately():
    async def go():
        parser = make_request_parser(Parser)
        messages, upgraded, tail = parser.feed_data(
            upgrade_head("/ws", content_length=0) + b"some raw data"
        )
        assert len(messages) == 1
        assert upgraded is True
        assert tail == b"some raw data"
        assert await asyncio.wait_for(messages[0][1].read(), 2) == b""

    asyncio.run(go())


def test_unsupported_upgrade_token_keeps_an_ordinary_body():
    async def go():
        parser = make_request_parser(Parser)
        request = (
            b"POST / HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\n"
            b"Upgrade: unknown\r\nContent-Length: 2\r\n\r\n{}"
        )
        messages, upgraded, tail = parser.feed_data(request)
        assert len(messages) == 1
        assert messages[0][0].upgrade is True
        assert upgraded is False
        assert tail == b""
        assert await asyncio.wait_for(messages[0][1].read(), 2) == b"{}"

    asyncio.run(go())
