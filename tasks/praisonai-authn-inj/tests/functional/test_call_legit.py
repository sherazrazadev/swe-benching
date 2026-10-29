"""Legitimate telephony use must keep working."""
from __future__ import annotations

from fastapi.testclient import TestClient

from support import harness

TOKEN = "tok-123"


def _client(app, host: str = "caller.example.test"):
    return TestClient(app, base_url="http://0.0.0.0:8765"), {"host": host}


def test_webhook_with_token_returns_stream_url_for_reached_host():
    _call, app = harness.call_app({"CALL_SERVER_TOKEN": TOKEN})
    client, headers = _client(app)
    response = client.get(f"/?token={TOKEN}", headers=headers)
    assert response.status_code == 200, response.text
    assert "wss://caller.example.test/media-stream" in response.text
    assert f"token={TOKEN}" in response.text


def test_webhook_accepts_bearer_token():
    _call, app = harness.call_app({"CALL_SERVER_TOKEN": TOKEN})
    client, headers = _client(app)
    response = client.get(
        "/", headers={**headers, "Authorization": f"Bearer {TOKEN}"}
    )
    assert response.status_code == 200, response.text
    assert "<Stream" in response.text


def test_webhook_accepts_post_with_token():
    _call, app = harness.call_app({"CALL_SERVER_TOKEN": TOKEN})
    client, headers = _client(app)
    response = client.post(f"/?token={TOKEN}", headers=headers)
    assert response.status_code == 200, response.text
    assert "<Stream" in response.text


def test_agent_router_with_token_works_on_public_bind():
    _call, app = harness.call_app({"CALL_SERVER_TOKEN": TOKEN})
    harness.register(_agent_module(), harness.RecordingAgent())
    response = TestClient(app, base_url="http://0.0.0.0:8765").get(
        "/api/v1/agents", headers={"Authorization": f"Bearer {TOKEN}"}
    )
    assert response.status_code == 200, response.text
    assert "agents" in response.json()


def test_started_call_server_with_token_serves_webhook():
    _call, app, captured = harness.start_call(
        {"CALL_SERVER_TOKEN": "tok-789"}, ["--port", "8768"]
    )
    assert captured.get("host") == "0.0.0.0"
    response = TestClient(app, base_url="http://0.0.0.0:8768").get(
        "/?token=tok-789", headers={"host": "caller.example.test"}
    )
    assert response.status_code == 200, response.text
    assert "wss://caller.example.test/media-stream" in response.text


def _agent_module():
    import praisonai.api.agent_invoke as agent_invoke

    return agent_invoke
