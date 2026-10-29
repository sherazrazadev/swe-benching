"""The agent API served by the telephony server must not be usable without authority."""
from __future__ import annotations

from fastapi.testclient import TestClient

from support import harness


def _client(app, bind: str = "0.0.0.0"):
    return TestClient(app, base_url=f"http://{bind}:8765")


def test_opted_out_listing_refused_when_bind_is_unknown():
    """An opt-out without a declared bind address must fail closed."""
    _call, app = harness.call_app({"PRAISONAI_CALL_AUTH": "disabled"})
    response = _client(app).get("/api/v1/agents", headers={"host": "localhost"})
    assert harness.status_is_refusal(response.status_code), response.text


def test_opted_out_listing_refused_on_non_local_bind():
    """A client-supplied local host name must not unlock a wide bind."""
    call, app = harness.call_app(
        {"PRAISONAI_CALL_AUTH": "disabled", "PRAISONAI_CALL_BIND_HOST": "0.0.0.0"}
    )
    agent = harness.register(_agent_module(), harness.RecordingAgent())
    response = _client(app).get("/api/v1/agents", headers={"host": "localhost"})
    assert harness.status_is_refusal(response.status_code), response.text
    assert agent.calls == []


def test_opted_out_invoke_refused_and_agent_not_run():
    call, app = harness.call_app(
        {"PRAISONAI_CALL_AUTH": "disabled", "PRAISONAI_CALL_BIND_HOST": "0.0.0.0"}
    )
    agent = harness.register(_agent_module(), harness.RecordingAgent())
    response = _client(app).post(
        "/api/v1/agents/helper/invoke",
        json={"message": "marker-1"},
        headers={"host": "localhost"},
    )
    assert harness.status_is_refusal(response.status_code), response.text
    assert agent.calls == []


def test_opted_out_unregister_refused_and_registration_kept():
    call, app = harness.call_app(
        {"PRAISONAI_CALL_AUTH": "disabled", "PRAISONAI_CALL_BIND_HOST": "0.0.0.0"}
    )
    agent_invoke = _agent_module()
    agent = harness.register(agent_invoke, harness.RecordingAgent())
    response = _client(app).delete("/api/v1/agents/helper", headers={"host": "localhost"})
    assert harness.status_is_refusal(response.status_code), response.text
    assert agent_invoke.get_agent("helper") is agent


def _agent_module():
    import praisonai.api.agent_invoke as agent_invoke

    return agent_invoke
