"""The telephony handlers must not run without the deployment's configured token."""
from __future__ import annotations

from fastapi.testclient import TestClient

from support import harness


def _client(app):
    return TestClient(app, base_url="http://0.0.0.0:8765")


def test_webhook_refused_when_no_token_is_configured():
    _call, app = harness.call_app({})
    response = _client(app).get("/", headers={"host": "localhost"})
    assert harness.status_is_refusal(response.status_code), response.text
    assert "<Stream" not in response.text


def test_webhook_post_refused_when_no_token_is_configured():
    _call, app = harness.call_app({})
    response = _client(app).post("/", headers={"host": "localhost"})
    assert harness.status_is_refusal(response.status_code), response.text
    assert "<Stream" not in response.text


def test_media_stream_refused_when_no_token_is_configured():
    _call, app = harness.call_app({})
    client = _client(app)
    with harness.upstream_connector() as started:
        try:
            with client.websocket_connect("/media-stream", headers={"host": "localhost"}):
                pass
        except Exception:
            pass
    assert started == [], "the media stream reached the upstream provider without a token"
