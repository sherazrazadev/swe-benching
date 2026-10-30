"""A user who owns both the thread and the session can still resume it."""

import uuid
from unittest.mock import AsyncMock, patch

from chainlit.auth import get_current_user
from chainlit.server import app
from chainlit.session import WebsocketSession

from helpers import make_persisted_user, make_session, make_user, new_id


def test_owner_can_resume_their_thread_into_their_session(client):
    owner = make_persisted_user(f"owner-{uuid.uuid4().hex[:10]}")
    same_account = make_user(owner.identifier)
    session = make_session(new_id("owner-session"), new_id("owner-socket"), owner)
    new_socket = new_id("owner-new-socket")

    data_layer = AsyncMock()
    data_layer.get_thread_author.side_effect = lambda thread_id: {
        "owner-thread": owner.identifier,
    }.get(thread_id)
    app.dependency_overrides[get_current_user] = lambda: same_account

    with patch("chainlit.data.acl.get_data_layer", return_value=data_layer):
        response = client.post(
            "/project/thread/resume",
            json={
                "threadId": "owner-thread",
                "sessionId": session.id,
                "socketId": new_socket,
            },
        )

    assert response.status_code == 200, response.text
    assert WebsocketSession.get(new_socket) is session
    assert session.socket_id == new_socket
    assert session.thread_id_to_resume == "owner-thread"
