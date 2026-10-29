"""A server must not describe itself as local when it listens on a wide address."""
from __future__ import annotations

from fastapi.testclient import TestClient

from support import harness


def test_reload_mode_does_not_claim_loopback():
    agent_invoke, app, captured = harness.serve_app(
        {"PRAISONAI_CALL_AUTH": "disabled"}, host="0.0.0.0", reload=True
    )
    harness.register(agent_invoke, harness.RecordingAgent())
    response = TestClient(app, base_url="http://0.0.0.0:8765").get(
        "/api/v1/agents", headers={"host": "localhost"}
    )
    assert harness.status_is_refusal(response.status_code), response.text
    assert captured.get("host") == "0.0.0.0"


def test_telephony_server_does_not_claim_loopback():
    _call, app, captured = harness.start_call(
        {"PRAISONAI_CALL_AUTH": "disabled"}, ["--port", "8766"]
    )
    harness.register(_agent_module(), harness.RecordingAgent())
    response = TestClient(app, base_url="http://0.0.0.0:8766").get(
        "/api/v1/agents", headers={"host": "localhost"}
    )
    assert harness.status_is_refusal(response.status_code), response.text
    assert captured.get("host") == "0.0.0.0"


def _agent_module():
    import praisonai.api.agent_invoke as agent_invoke

    return agent_invoke
