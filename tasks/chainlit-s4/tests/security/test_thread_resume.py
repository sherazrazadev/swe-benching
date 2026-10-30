"""Authoring a thread must not authorize binding a session the caller does not own."""

import uuid
from unittest.mock import AsyncMock, patch

from chainlit.auth import get_current_user
from chainlit.server import app
from chainlit.session import WebsocketSession

from helpers import make_persisted_user, make_session, new_id


def test_resume_request_does_not_rebind_another_users_session(client):
    victim_user = make_persisted_user(f"victim-{uuid.uuid4().hex[:10]}")
    attacker = make_persisted_user(f"attacker-{uuid.uuid4().hex[:10]}")
    victim_socket = new_id("victim-socket")
    victim = make_session(new_id("victim-session"), victim_socket, victim_user)
    attacker_socket = new_id("attacker-socket")

    data_layer = AsyncMock()
    data_layer.get_thread_author.side_effect = lambda thread_id: {
        "attacker-thread": attacker.identifier,
    }.get(thread_id)
    app.dependency_overrides[get_current_user] = lambda: attacker

    with patch("chainlit.data.acl.get_data_layer", return_value=data_layer):
        response = client.post(
            "/project/thread/resume",
            json={
                "threadId": "attacker-thread",
                "sessionId": victim.id,
                "socketId": attacker_socket,
            },
        )

    assert 400 <= response.status_code < 500, response.text
    assert victim.socket_id == victim_socket
    assert WebsocketSession.get(attacker_socket) is None
    assert WebsocketSession.get_by_id(victim.id) is victim
