"""Build a request parser wired to a real RequestHandler, as the server does."""
import asyncio
from unittest import mock

from aiohttp.helpers import DEFAULT_CHUNK_SIZE
from aiohttp.web_protocol import RequestHandler
from aiohttp.web_server import Server


def make_request_parser(cls):
    loop = asyncio.get_running_loop()
    server = mock.create_autospec(
        Server,
        request_factory=mock.Mock(),
        request_handler=mock.AsyncMock(),
        instance=True,
    )
    protocol = RequestHandler(server, loop=loop)
    protocol._force_close = False
    protocol.transport = mock.Mock()
    parser = cls(protocol, loop, DEFAULT_CHUNK_SIZE)
    protocol._parser = parser
    return parser
