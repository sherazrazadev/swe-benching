"""A connection must not be bound to a session owned by another account."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest

from chainlit.session import WebsocketSession
from chainlit.socket import connect

from helpers import make_persisted_user, make_session, make_socket_auth, make_user, new_id


async def test_connection_naming_another_users_session_is_refused():
    victim_user = make_persisted_user(f"victim-{uuid.uuid4().hex[:10]}")
    attacker = make_user(f"attacker-{uuid.uuid4().hex[:10]}")
    victim_socket = new_id("victim-socket")
    victim = make_session(new_id("victim-session"), victim_socket, victim_user)
    attacker_socket = new_id("attacker-socket")

    authenticate = AsyncMock(return_value=(attacker, "attacker-token"))
    with patch("chainlit.socket.require_login", return_value=True), patch(
        "chainlit.socket._authenticate_connection", new=authenticate
    ):
        with pytest.raises(ConnectionRefusedError):
            await connect(
                attacker_socket,
                {"HTTP_COOKIE": "token=attacker-token"},
                make_socket_auth(victim.id),
            )

    assert WebsocketSession.get(attacker_socket) is None
    assert WebsocketSession.get_by_id(victim.id) is victim
    assert victim.socket_id == victim_socket


async def test_connection_naming_an_unowned_session_is_refused_to_an_authenticated_caller():
    """A session with no owner may only be used by an unauthenticated connection."""
    attacker = make_user(f"attacker-{uuid.uuid4().hex[:10]}")
    unowned = make_session(new_id("unowned-session"), new_id("unowned-socket"), None)
    attacker_socket = new_id("attacker-socket")

    authenticate = AsyncMock(return_value=(attacker, "attacker-token"))
    with patch("chainlit.socket.require_login", return_value=True), patch(
        "chainlit.socket._authenticate_connection", new=authenticate
    ):
        with pytest.raises(ConnectionRefusedError):
            await connect(
                attacker_socket,
                {"HTTP_COOKIE": "token=attacker-token"},
                make_socket_auth(unowned.id),
            )

    assert WebsocketSession.get(attacker_socket) is None
    assert WebsocketSession.get_by_id(unowned.id) is unowned


async def test_unauthenticated_connection_naming_an_owned_session_is_refused():
    """A session that has an owner may not be used by an unauthenticated connection."""
    owner = make_persisted_user(f"owner-{uuid.uuid4().hex[:10]}")
    victim_socket = new_id("victim-socket")
    victim = make_session(new_id("victim-session"), victim_socket, owner)
    attacker_socket = new_id("attacker-socket")

    with patch("chainlit.socket.require_login", return_value=False):
        with pytest.raises(ConnectionRefusedError):
            await connect(attacker_socket, {}, make_socket_auth(victim.id))

    assert WebsocketSession.get(attacker_socket) is None
    assert WebsocketSession.get_by_id(victim.id) is victim
    assert victim.socket_id == victim_socket
