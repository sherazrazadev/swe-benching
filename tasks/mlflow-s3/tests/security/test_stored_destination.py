import gwhelper as gw


def _public_then_store(name, provider, model_name, stored_auth_config):
    status, data = gw.create_secret(
        name, provider=provider, secret_value={"api_key": "sk-test"},
        auth_config={"api_base": "https://8.8.8.8/v1"},
    )
    assert status == 200, data
    secret_id = data["secret"]["secret_id"]
    status, _ = gw.link_endpoint(name, secret_id, provider, model_name)
    assert status == 200
    # Replace the stored row outside the request path, as a row written before a
    # check existed would look when it is reloaded.
    gw.raw_sql_set_auth_config(secret_id, stored_auth_config)
    return secret_id


def test_stored_internal_destination_is_never_dialed():
    canary = gw.Canary()
    try:
        name = gw.unique("stored")
        _public_then_store(
            name, "openai", "gpt-4o",
            {"api_base": f"http://127.0.0.1:{canary.port}/v1"},
        )
        response = gw.invoke(name + "-ep")
        assert 400 <= response.status_code < 500, response.text
        assert canary.count() == 0, "the gateway dialed an address held in stored configuration"
    finally:
        canary.close()


def test_stored_workspace_destination_is_never_dialed():
    canary = gw.Canary()
    try:
        name = gw.unique("storeddbx")
        _public_then_store(
            name, "databricks", "dbrx",
            {"api_base": f"http://127.0.0.1:{canary.port}"},
        )
        response = gw.invoke(name + "-ep")
        assert 400 <= response.status_code < 500, response.text
        assert canary.count() == 0, "a workspace client dialed a stored address"
    finally:
        canary.close()


def test_stored_legacy_value_is_never_dialed():
    canary = gw.Canary()
    try:
        name = gw.unique("storedlegacy")
        _public_then_store(
            name, "openai", "gpt-4o",
            {"host": f"http://127.0.0.1:{canary.port}/v1"},
        )
        response = gw.invoke(name + "-ep")
        assert 400 <= response.status_code < 500, response.text
        assert canary.count() == 0, "a stored legacy value set the destination"
    finally:
        canary.close()


def test_stored_warm_up_destination_is_never_dialed():
    canary = gw.Canary()
    try:
        name = gw.unique("storedwarm")
        _public_then_store(
            name, "cohere", "command-r",
            {"api_base": f"http://127.0.0.1:{canary.port}/v1", "warm_up": "true"},
        )
        response = gw.invoke(name + "-ep")
        assert 400 <= response.status_code < 500, response.text
        assert canary.count() == 0, "a diagnostic request reached a stored address"
    finally:
        canary.close()
