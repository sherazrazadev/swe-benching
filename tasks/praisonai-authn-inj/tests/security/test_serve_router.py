"""The `serve agents` server exposes the same agent registry through its mounted API."""
from __future__ import annotations

from fastapi.testclient import TestClient

from support import harness


def _client(app):
    return TestClient(app, base_url="http://0.0.0.0:8765")


def test_serve_agents_listing_refused_on_public_bind():
    agent_invoke, app, _captured = harness.serve_app(
        {"PRAISONAI_CALL_AUTH": "disabled"}, host="0.0.0.0"
    )
    harness.register(agent_invoke, harness.RecordingAgent())
    response = _client(app).get("/api/v1/agents", headers={"host": "localhost"})
    assert harness.status_is_refusal(response.status_code), response.text


def test_serve_agents_invoke_refused_on_public_bind():
    agent_invoke, app, _captured = harness.serve_app(
        {"PRAISONAI_CALL_AUTH": "disabled"}, host="0.0.0.0"
    )
    agent = harness.register(agent_invoke, harness.RecordingAgent())
    response = _client(app).post(
        "/api/v1/agents/helper/invoke",
        json={"message": "marker-2"},
        headers={"host": "localhost"},
    )
    assert harness.status_is_refusal(response.status_code), response.text
    assert agent.calls == []


def test_serve_agents_unregister_refused_on_public_bind():
    agent_invoke, app, _captured = harness.serve_app(
        {"PRAISONAI_CALL_AUTH": "disabled"}, host="0.0.0.0"
    )
    agent = harness.register(agent_invoke, harness.RecordingAgent())
    response = _client(app).delete("/api/v1/agents/helper", headers={"host": "localhost"})
    assert harness.status_is_refusal(response.status_code), response.text
    assert agent_invoke.get_agent("helper") is agent
