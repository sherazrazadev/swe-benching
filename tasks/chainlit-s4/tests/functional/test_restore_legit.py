"""Legitimate reconnects keep working exactly as they do today."""

import uuid
from unittest.mock import AsyncMock, patch

from chainlit.session import WebsocketSession
from chainlit.socket import connect

from helpers import (
    make_persisted_user,
    make_session,
    make_socket_auth,
    make_user,
    new_id,
)


async def test_owner_reconnects_to_their_own_session():
    owner = make_persisted_user(f"owner-{uuid.uuid4().hex[:10]}")
    # The same account authenticated again: a different object, same identity.
    same_account = make_user(owner.identifier)
    session = make_session(new_id("owner-session"), new_id("owner-socket"), owner)
    new_socket = new_id("owner-new-socket")

    authenticate = AsyncMock(return_value=(same_account, "owner-token"))
    with patch("chainlit.socket.require_login", return_value=True), patch(
        "chainlit.socket._authenticate_connection", new=authenticate
    ):
        result = await connect(
            new_socket, {"HTTP_COOKIE": "token=owner-token"}, make_socket_auth(session.id)
        )

    assert result is True
    assert WebsocketSession.get(new_socket) is session
    assert session.socket_id == new_socket


async def test_unauthenticated_client_reconnects_to_an_unowned_session():
    session = make_session(new_id("open-session"), new_id("open-socket"), None)
    new_socket = new_id("open-new-socket")

    with patch("chainlit.socket.require_login", return_value=False):
        result = await connect(new_socket, {}, make_socket_auth(session.id))

    assert result is True
    assert WebsocketSession.get(new_socket) is session
    assert session.socket_id == new_socket


async def test_connection_with_an_unknown_identifier_still_creates_a_session():
    fresh = new_id("fresh-session")
    socket = new_id("fresh-socket")

    with patch("chainlit.socket.require_login", return_value=False):
        result = await connect(socket, {}, make_socket_auth(fresh))

    assert result is True
    created = WebsocketSession.get_by_id(fresh)
    assert created is not None
    assert created.socket_id == socket


async def test_authenticated_owner_reconnects_when_nothing_else_changed():
    owner = make_persisted_user(f"owner-{uuid.uuid4().hex[:10]}")
    session = make_session(new_id("plain-session"), new_id("plain-socket"), owner)
    new_socket = new_id("plain-new-socket")

    authenticate = AsyncMock(return_value=(owner, "owner-token"))
    with patch("chainlit.socket.require_login", return_value=True), patch(
        "chainlit.socket._authenticate_connection", new=authenticate
    ):
        result = await connect(
            new_socket, {"HTTP_COOKIE": "token=owner-token"}, make_socket_auth(session.id)
        )

    assert result is True
    assert WebsocketSession.get(new_socket) is session
