"""Helpers shared by the hidden suites.

Everything here drives product entry points as a client would: real
WebsocketSession objects registered in the product's own registries, and the
real FastAPI app. Expected values are computed in the tests themselves.
"""

import uuid

from chainlit.session import WebsocketSession
from chainlit.user import PersistedUser, User


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4()}"


def make_user(identifier: str) -> User:
    return User(identifier=identifier)


def make_persisted_user(identifier: str) -> PersistedUser:
    return PersistedUser(
        id=f"db-{identifier}",
        createdAt="2026-01-01T00:00:00",
        identifier=identifier,
    )


def make_session(session_id: str, socket_id: str, user) -> WebsocketSession:
    return WebsocketSession(
        id=session_id,
        socket_id=socket_id,
        emit=lambda event, data: None,
        emit_call=lambda event, data, timeout=None: None,
        user_env={"API_KEY": "victim-value"} if user else {},
        client_type="webapp",
        environ={},
        user=user,
    )


def make_socket_auth(session_id: str) -> dict:
    return {
        "sessionId": session_id,
        "clientType": "webapp",
        "userEnv": "{}",
        "threadId": None,
    }


def feedback_body(session_id: str) -> dict:
    return {
        "feedback": {"forId": "step-1", "value": 1, "comment": "ok"},
        "sessionId": session_id,
    }
