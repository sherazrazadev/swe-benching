import urllib.request
from unittest import mock

import aiohttp
import litellm

import gwhelper as gw


def _litellm_response():
    response = mock.MagicMock()
    response.id = "litellm-chat-id"
    response.object = "chat.completion"
    response.created = 1234567890
    response.model = "command-r"
    choice = mock.MagicMock()
    choice.index = 0
    choice.message.role = "assistant"
    choice.message.content = "ok"
    choice.message.tool_calls = None
    choice.finish_reason = "stop"
    response.choices = [choice]
    response.usage.prompt_tokens = 1
    response.usage.completion_tokens = 1
    response.usage.total_tokens = 2
    return response


def test_public_destination_reaches_the_fallback_client(monkeypatch):
    seen = {}

    async def fake_acompletion(**kwargs):
        seen.update(kwargs)
        return _litellm_response()

    monkeypatch.setattr(litellm, "acompletion", fake_acompletion)

    name = gw.unique("fallback")
    status, data = gw.create_secret(
        name,
        provider="cohere",
        secret_value={"api_key": "sk-test"},
        auth_config={"api_base": "https://8.8.8.8/v1"},
    )
    assert status == 200, data
    secret_id = data["secret"]["secret_id"]
    status, _ = gw.link_endpoint(name, secret_id, "cohere", "command-r")
    assert status == 200

    response = gw.invoke(name + "-ep")
    assert response.status_code == 200, response.text
    assert seen.get("api_base") == "https://8.8.8.8/v1"


def test_legacy_public_host_value_is_used(monkeypatch):
    fake = gw.FakeAiohttp()
    monkeypatch.setattr(aiohttp, "ClientSession", fake)

    name = gw.unique("legacyok")
    status, data = gw.create_secret(
        name, provider="openai", secret_value={"api_key": "sk-test"},
        auth_config={"host": "https://8.8.8.8/v1"},
    )
    assert status == 200, data
    secret_id = data["secret"]["secret_id"]
    status, _ = gw.link_endpoint(name, secret_id, "openai", "gpt-4o")
    assert status == 200

    response = gw.invoke(name + "-ep")
    assert response.status_code == 200, response.text
    assert fake.urls == ["https://8.8.8.8/v1/chat/completions"]


def test_warm_up_is_not_sent_without_the_flag(monkeypatch):
    opened = mock.Mock()
    monkeypatch.setattr(urllib.request, "urlopen", opened)

    async def fake_acompletion(**kwargs):
        return _litellm_response()

    monkeypatch.setattr(litellm, "acompletion", fake_acompletion)

    name = gw.unique("nowarm")
    status, data = gw.create_secret(
        name,
        provider="cohere",
        secret_value={"api_key": "sk-test"},
        auth_config={"api_base": "https://8.8.8.8/v1"},
    )
    assert status == 200, data
    secret_id = data["secret"]["secret_id"]
    status, _ = gw.link_endpoint(name, secret_id, "cohere", "command-r")
    assert status == 200

    response = gw.invoke(name + "-ep")
    assert response.status_code == 200, response.text
    assert not opened.called, "a diagnostic request was sent without being asked for"
