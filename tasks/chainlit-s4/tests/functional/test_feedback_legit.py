"""The application's feedback handling keeps working for its legitimate callers."""

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


def _install_callback(observed):
    async def on_feedback(feedback):
        observed.append(getattr(context.session, "id", None))

    project_config.code.on_feedback = on_feedback


def test_owner_feedback_handling_runs_with_their_own_session(client):
    owner = make_persisted_user(f"owner-{uuid.uuid4().hex[:10]}")
    same_account = make_user(owner.identifier)
    session = make_session(new_id("owner-session"), new_id("owner-socket"), owner)

    observed = []
    _install_callback(observed)
    data_layer = AsyncMock()
    data_layer.upsert_feedback.return_value = "feedback-id"
    app.dependency_overrides[get_current_user] = lambda: same_account

    with patch("chainlit.server.get_data_layer", return_value=data_layer):
        response = client.put("/feedback", json=feedback_body(session.id))

    assert response.status_code == 200, response.text
    assert observed == [session.id]
    assert WebsocketSession.get_by_id(session.id) is session
    data_layer.upsert_feedback.assert_awaited_once()


def test_feedback_handling_still_runs_in_a_session_with_no_owner(client):
    session = make_session(new_id("open-session"), new_id("open-socket"), None)

    observed = []
    _install_callback(observed)
    data_layer = AsyncMock()
    data_layer.upsert_feedback.return_value = "feedback-id"
    app.dependency_overrides[get_current_user] = lambda: None

    with patch("chainlit.server.get_data_layer", return_value=data_layer):
        response = client.put("/feedback", json=feedback_body(session.id))

    assert response.status_code == 200, response.text
    assert observed == [session.id]
    data_layer.upsert_feedback.assert_awaited_once()
