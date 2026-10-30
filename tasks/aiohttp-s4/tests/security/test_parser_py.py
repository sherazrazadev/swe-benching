"""A request that announces a body must not be switched away from before it is read."""
import asyncio

from aiohttp.http_parser import HttpRequestParserPy as Parser

from support.harness import chunked_body, upgrade_head
from support.parsers import make_request_parser

BODY = b"declared-request-body"
AFTER = b"GET /after HTTP/1.1\r\nHost: localhost\r\n\r\n"


def _split_feed(head, rest, expected_body, expected_tail):
    async def go():
        parser = make_request_parser(Parser)
        messages, upgraded, tail = parser.feed_data(head)
        assert len(messages) == 1
        msg, payload = messages[0]
        assert msg.upgrade is True
        assert upgraded is False, (
            "the connection switched protocols while the announced body was still "
            "outstanding"
        )
        assert tail == b""

        messages2, upgraded2, tail2 = parser.feed_data(rest)
        body = await asyncio.wait_for(payload.read(), 2)
        assert body == expected_body
        assert upgraded2 is True
        assert tail2 == expected_tail

    asyncio.run(go())


def test_content_length_body_is_read_before_the_switch():
    _split_feed(
        upgrade_head("/ws", content_length=len(BODY)),
        BODY + AFTER,
        BODY,
        AFTER,
    )


def test_chunked_body_is_read_before_the_switch():
    _split_feed(
        upgrade_head("/ws", chunked=True),
        chunked_body(BODY) + AFTER,
        BODY,
        AFTER,
    )


def test_body_and_following_request_in_one_packet():
    async def go():
        parser = make_request_parser(Parser)
        messages, upgraded, tail = parser.feed_data(
            upgrade_head("/ws", content_length=len(BODY)) + BODY + AFTER
        )
        assert len(messages) == 1
        msg, payload = messages[0]
        assert msg.upgrade is True
        assert upgraded is True
        assert tail == AFTER
        assert await asyncio.wait_for(payload.read(), 2) == BODY

    asyncio.run(go())
