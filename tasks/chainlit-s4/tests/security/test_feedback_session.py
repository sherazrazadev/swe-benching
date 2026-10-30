"""A request naming another user's session must not run the application's
feedback handling inside that session."""

import uuid
from unittest.mock import AsyncMock, patch

from chainlit.auth import get_current_user
from chainlit.config import config as project_config
from chainlit.context import context
from chainlit.server import app
from chainlit.session import WebsocketSession

from helpers import (
    feedback_body,
    make_persisted_user,
    make_session,
    make_user,
    new_id,
)


def test_feedback_request_does_not_run_in_another_users_session(client):
    victim_user = make_persisted_user(f"victim-{uuid.uuid4().hex[:10]}")
    attacker = make_user(f"attacker-{uuid.uuid4().hex[:10]}")
    victim_socket = new_id("victim-socket")
    victim = make_session(new_id("victim-session"), victim_socket, victim_user)

    observed = []

    async def on_feedback(feedback):
        observed.append(getattr(context.session, "id", None))

    project_config.code.on_feedback = on_feedback

    data_layer = AsyncMock()
    data_layer.upsert_feedback.return_value = "feedback-id"
    app.dependency_overrides[get_current_user] = lambda: attacker

    with patch("chainlit.server.get_data_layer", return_value=data_layer):
        response = client.put("/feedback", json=feedback_body(victim.id))

    assert 400 <= response.status_code < 500, response.text
    assert observed == []
    assert WebsocketSession.get_by_id(victim.id) is victim
    assert victim.socket_id == victim_socket
