"""The `serve agents` workflow-compatibility routes reach the same registry."""
from __future__ import annotations

from fastapi.testclient import TestClient

from support import harness


def _client(app):
    return TestClient(app, base_url="http://0.0.0.0:8765")


def test_single_agent_route_refused_on_public_bind():
    agent_invoke, app, _captured = harness.serve_app({}, host="0.0.0.0")
    agent = harness.register(agent_invoke, harness.RecordingAgent())
    response = _client(app).post("/agents/helper", json={"query": "marker-3"})
    assert harness.status_is_refusal(response.status_code), response.text
    assert agent.calls == []


def test_workflow_route_refused_on_public_bind():
    agent_invoke, app, _captured = harness.serve_app({}, host="0.0.0.0")
    agent = harness.register(agent_invoke, harness.RecordingAgent())
    response = _client(app).post(
        "/agents", json={"query": "marker-4", "agent": "helper"}
    )
    assert harness.status_is_refusal(response.status_code), response.text
    assert agent.calls == []
