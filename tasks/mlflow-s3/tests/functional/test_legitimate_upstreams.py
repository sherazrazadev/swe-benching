import gwhelper as gw


def test_shipped_local_default_is_still_called():
    canary = gw.Canary(11434)
    try:
        name = gw.unique("default")
        status, data = gw.create_secret(
            name, provider="ollama", secret_value={"api_key": "ollama"}
        )
        assert status == 200, data
        secret_id = data["secret"]["secret_id"]
        status, _ = gw.link_endpoint(name, secret_id, "ollama", "llama3")
        assert status == 200
        response = gw.invoke(name + "-ep")
        assert response.status_code == 200, response.text
        assert canary.count() >= 1, "the built-in default destination was not called"
    finally:
        canary.close()


def test_public_configuration_round_trip():
    name = gw.unique("public")
    status, data = gw.create_secret(
        name, provider="openai", auth_config={"api_base": "https://8.8.8.8/v1"}
    )
    assert status == 200, data
    secret_id = data["secret"]["secret_id"]
    assert name in gw.list_secret_names()

    status, data = gw.get_secret(secret_id)
    assert status == 200, data
    assert data["secret"]["auth_config"]["api_base"] == "https://8.8.8.8/v1"

    status, data = gw.update_secret(secret_id, auth_config={"api_base": "https://1.1.1.1/v1"})
    assert status == 200, data

    status, data = gw.get_secret(secret_id)
    assert status == 200, data
    assert data["secret"]["auth_config"]["api_base"] == "https://1.1.1.1/v1"


def test_legitimate_workspace_host_is_accepted():
    status, data = gw.create_secret(
        gw.unique("workspace"),
        provider="databricks",
        secret_value={"api_key": "dapi-test"},
        auth_config={"api_base": "https://my-workspace.databricks.com"},
    )
    assert status == 200, data


def test_legitimate_region_and_location_names_are_accepted():
    for location in ("global", "us-central1", "europe-west4"):
        status, data = gw.create_secret(
            gw.unique("vertex"),
            provider="vertex_ai",
            secret_value={"api_key": "test-key", "vertex_credentials": "{}"},
            auth_config={"vertex_project": "test-project", "vertex_location": location},
        )
        assert status == 200, (location, data)

    for region in ("us-east-1", "eu-west-1"):
        status, data = gw.create_secret(
            gw.unique("bedrock"),
            provider="bedrock",
            secret_value={"api_key": "test-key"},
            auth_config={"auth_mode": "api_key", "aws_region_name": region},
        )
        assert status == 200, (region, data)
