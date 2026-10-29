"""The optional API-key opt-out must follow the server's bind, not the request."""
from __future__ import annotations

from fastapi.testclient import TestClient

from support import harness


def _client(app):
    return TestClient(app, base_url="http://0.0.0.0:8765")


def _serve_with_optout():
    return harness.serve_app(
        {"PRAISONAI_SERVE_AUTH": "disabled"}, host="0.0.0.0", api_key="secret"
    )


def test_optout_not_taken_from_local_host_name():
    agent_invoke, app, _captured = _serve_with_optout()
    agent = harness.register(agent_invoke, harness.RecordingAgent())
    response = _client(app).post(
        "/agents/helper", json={"query": "marker-5"}, headers={"host": "localhost"}
    )
    assert harness.status_is_refusal(response.status_code), response.text
    assert agent.calls == []


def test_optout_not_taken_from_loopback_ip_host_name():
    agent_invoke, app, _captured = _serve_with_optout()
    agent = harness.register(agent_invoke, harness.RecordingAgent())
    response = _client(app).post(
        "/agents/helper", json={"query": "marker-6"}, headers={"host": "127.0.0.1"}
    )
    assert harness.status_is_refusal(response.status_code), response.text
    assert agent.calls == []
