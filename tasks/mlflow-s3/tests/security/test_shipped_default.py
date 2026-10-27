import gwhelper as gw


def test_supplied_address_matching_the_shipped_default_is_refused():
    name = gw.unique("shipped")
    status, data = gw.create_secret(
        name,
        provider="ollama",
        secret_value={"api_key": "ollama"},
        auth_config={"api_base": "http://127.0.0.1:11434/v1"},
    )
    assert 400 <= status < 500, (status, data)
    assert name not in gw.list_secret_names()
