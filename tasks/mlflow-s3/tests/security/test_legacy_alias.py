import gwhelper as gw


def test_legacy_host_value_cannot_set_the_destination():
    canary = gw.Canary()
    try:
        name = gw.unique("legacy")
        status, data = gw.create_secret(
            name,
            provider="openai",
            secret_value={"api_key": "sk-test"},
            auth_config={"host": f"http://127.0.0.1:{canary.port}/v1"},
        )
        assert 400 <= status < 500, (status, data)
        assert name not in gw.list_secret_names()
        assert canary.count() == 0, "a stored legacy value set the destination"
    finally:
        canary.close()
