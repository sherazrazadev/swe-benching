"""Process-wide state each hidden test must leave exactly as it found it.

The product keeps live sessions and user sessions in module-level registries and
lets the embedding application register callbacks on the config object. Tests
snapshot and restore all of that themselves, so a hardened product helper is
never asked to do a test's bookkeeping.
"""

import pytest

from chainlit.config import config as project_config
from chainlit.server import app
from chainlit.session import ws_sessions_id, ws_sessions_sid
from chainlit.user_session import user_sessions


@pytest.fixture(autouse=True)
def reset_process_state():
    ids = dict(ws_sessions_id)
    sids = dict(ws_sessions_sid)
    sessions = dict(user_sessions)
    previous_on_feedback = getattr(project_config.code, "on_feedback", None)
    try:
        yield
    finally:
        ws_sessions_id.clear()
        ws_sessions_id.update(ids)
        ws_sessions_sid.clear()
        ws_sessions_sid.update(sids)
        user_sessions.clear()
        user_sessions.update(sessions)
        project_config.code.on_feedback = previous_on_feedback
        app.dependency_overrides.clear()


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    return TestClient(app)
