"""Legitimate `serve agents` use must keep working."""
from __future__ import annotations

from fastapi.testclient import TestClient

from support import harness

API_KEY = "secret"


def _serve(values, host, api_key=None, reload=False):
    return harness.serve_app(values, host=host, api_key=api_key, reload=reload)


def test_loopback_optout_still_allows_listing():
    agent_invoke, app, _captured = _serve(
        {"PRAISONAI_CALL_AUTH": "disabled"}, "127.0.0.1"
    )
    harness.register(agent_invoke, harness.RecordingAgent())
    response = TestClient(app, base_url="http://127.0.0.1:8765").get("/api/v1/agents")
    assert response.status_code == 200, response.text


def test_loopback_optout_still_allows_single_agent_invoke():
    agent_invoke, app, _captured = _serve(
        {"PRAISONAI_CALL_AUTH": "disabled"}, "127.0.0.1"
    )
    agent = harness.register(agent_invoke, harness.RecordingAgent())
    response = TestClient(app, base_url="http://127.0.0.1:8765").post(
        "/agents/helper", json={"query": "hello"}
    )
    assert response.status_code == 200, response.text
    assert agent.calls == ["hello"]


def test_loopback_optout_still_allows_workflow_route():
    agent_invoke, app, _captured = _serve(
        {"PRAISONAI_CALL_AUTH": "disabled"}, "127.0.0.1"
    )
    agent = harness.register(agent_invoke, harness.RecordingAgent())
    response = TestClient(app, base_url="http://127.0.0.1:8765").post(
        "/agents", json={"query": "hello", "agent": "helper"}
    )
    assert response.status_code == 200, response.text
    assert agent.calls == ["hello"]


def test_loopback_reload_optout_still_allows_listing():
    agent_invoke, app, captured = _serve(
        {"PRAISONAI_CALL_AUTH": "disabled"}, "127.0.0.1", reload=True
    )
    harness.register(agent_invoke, harness.RecordingAgent())
    response = TestClient(app, base_url="http://127.0.0.1:8765").get("/api/v1/agents")
    assert response.status_code == 200, response.text
    assert captured.get("host") == "127.0.0.1"


def test_loopback_api_key_optout_still_skips_the_key():
    agent_invoke, app, _captured = _serve(
        {"PRAISONAI_SERVE_AUTH": "disabled"}, "127.0.0.1", api_key=API_KEY
    )
    agent = harness.register(agent_invoke, harness.RecordingAgent())
    response = TestClient(app, base_url="http://127.0.0.1:8765").post(
        "/agents/helper", json={"query": "hello"}
    )
    assert response.status_code == 200, response.text
    assert agent.calls == ["hello"]


def test_public_bind_with_api_key_allows_authenticated_call():
    agent_invoke, app, _captured = _serve({}, "0.0.0.0", api_key=API_KEY)
    agent = harness.register(agent_invoke, harness.RecordingAgent())
    response = TestClient(app, base_url="http://0.0.0.0:8765").post(
        "/agents/helper", json={"query": "hello"}, headers={"X-API-Key": API_KEY}
    )
    assert response.status_code == 200, response.text
    assert agent.calls == ["hello"]


def test_public_bind_with_api_key_still_rejects_a_missing_key():
    _agent_invoke, app, _captured = _serve({}, "0.0.0.0", api_key=API_KEY)
    response = TestClient(app, base_url="http://0.0.0.0:8765").post(
        "/agents/helper", json={"query": "hello"}
    )
    assert harness.status_is_refusal(response.status_code), response.text


def test_public_tunnel_still_serves_the_webhook_with_token():
    token = "tok-456"
    _call, app, captured = harness.start_call(
        {"CALL_SERVER_TOKEN": token}, ["--public", "--port", "8767"]
    )
    assert captured.get("host") == "0.0.0.0"
    response = TestClient(app, base_url="http://0.0.0.0:8767").get(
        f"/?token={token}", headers={"host": "caller.example.test"}
    )
    assert response.status_code == 200, response.text
    assert "wss://caller.example.test/media-stream" in response.text
