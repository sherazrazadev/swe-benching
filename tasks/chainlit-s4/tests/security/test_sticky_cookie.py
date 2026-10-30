"""The identifier a request carries in the product's sticky session cookie is
subject to the same ownership rule as the one carried on the connection."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest

from chainlit.session import WebsocketSession
from chainlit.socket import connect

from helpers import make_persisted_user, make_session, make_socket_auth, make_user, new_id


async def test_connection_carrying_another_users_session_cookie_is_refused():
    victim_user = make_persisted_user(f"victim-{uuid.uuid4().hex[:10]}")
    attacker = make_user(f"attacker-{uuid.uuid4().hex[:10]}")
    victim_socket = new_id("victim-socket")
    victim = make_session(new_id("victim-session"), victim_socket, victim_user)
    attacker_socket = new_id("attacker-socket")

    authenticate = AsyncMock(return_value=(attacker, "attacker-token"))
    environ = {
        "HTTP_COOKIE": (
            "token=attacker-token; "
            f"X-Chainlit-Session-id={victim.id}"
        )
    }
    with patch("chainlit.socket.require_login", return_value=True), patch(
        "chainlit.socket._authenticate_connection", new=authenticate
    ):
        with pytest.raises(ConnectionRefusedError):
            await connect(
                attacker_socket,
                environ,
                make_socket_auth(new_id("unused-session")),
            )

    assert victim.socket_id == victim_socket
    assert WebsocketSession.get(attacker_socket) is None
    assert WebsocketSession.get_by_id(victim.id) is victim
