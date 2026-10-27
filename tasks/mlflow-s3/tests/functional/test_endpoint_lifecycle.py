import aiohttp

import gwhelper as gw


def test_endpoint_and_model_definition_lifecycle():
    name = gw.unique("lifecycle")
    status, data = gw.create_secret(
        name, provider="openai", auth_config={"api_base": "https://8.8.8.8/v1"}
    )
    assert status == 200, data
    secret_id = data["secret"]["secret_id"]

    status, data = gw.create_model_definition(name + "-md", secret_id, "openai", "gpt-4o")
    assert status == 200, data
    model_definition_id = data["model_definition"]["model_definition_id"]

    status, data = gw.create_endpoint(name + "-ep", model_definition_id)
    assert status == 200, data

    status, data = gw.get_endpoint(name + "-ep")
    assert status == 200, data
    assert data["endpoint"]["name"] == name + "-ep"


def test_public_destination_is_used(monkeypatch):
    fake = gw.FakeAiohttp()
    monkeypatch.setattr(aiohttp, "ClientSession", fake)

    name = gw.unique("publiccall")
    status, data = gw.create_secret(
        name, provider="openai", auth_config={"api_base": "https://8.8.8.8/v1"}
    )
    assert status == 200, data
    secret_id = data["secret"]["secret_id"]
    status, _ = gw.link_endpoint(name, secret_id, "openai", "gpt-4o")
    assert status == 200

    response = gw.invoke(name + "-ep")
    assert response.status_code == 200, response.text
    assert fake.urls == ["https://8.8.8.8/v1/chat/completions"]
