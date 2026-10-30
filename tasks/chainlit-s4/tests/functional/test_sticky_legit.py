"""The product's sticky session cookie keeps restoring the caller's own session."""

import uuid
from unittest.mock import AsyncMock, patch

from chainlit.session import WebsocketSession
from chainlit.socket import connect

from helpers import make_persisted_user, make_session, new_id


def _auth_for(session_id):
    return {
        "sessionId": session_id,
        "clientType": "webapp",
        "userEnv": "{}",
        "threadId": None,
    }


async def test_owner_reconnect_by_session_cookie_restores_their_session():
    owner = make_persisted_user(f"owner-{uuid.uuid4().hex[:10]}")
    session = make_session(new_id("owner-session"), new_id("owner-socket"), owner)
    new_socket = new_id("owner-new-socket")

    authenticate = AsyncMock(return_value=(owner, "owner-token"))
    environ = {
        "HTTP_COOKIE": f"token=owner-token; X-Chainlit-Session-id={session.id}"
    }
    with patch("chainlit.socket.require_login", return_value=True), patch(
        "chainlit.socket._authenticate_connection", new=authenticate
    ):
        result = await connect(new_socket, environ, _auth_for(new_id("unused-session")))

    assert result is True
    assert WebsocketSession.get(new_socket) is session
    assert session.socket_id == new_socket


async def test_unauthenticated_reconnect_by_session_cookie_restores_an_unowned_session():
    session = make_session(new_id("open-session"), new_id("open-socket"), None)
    new_socket = new_id("open-new-socket")
    environ = {"HTTP_COOKIE": f"X-Chainlit-Session-id={session.id}"}

    with patch("chainlit.socket.require_login", return_value=False):
        result = await connect(new_socket, environ, _auth_for(new_id("unused-session")))

    assert result is True
    assert WebsocketSession.get(new_socket) is session
    assert session.socket_id == new_socket
