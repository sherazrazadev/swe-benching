import gwhelper as gw


def _refused_at_supply(name, provider, secret_value, auth_config, canary):
    status, data = gw.create_secret(
        name, secret_value=secret_value, provider=provider, auth_config=auth_config
    )
    assert 400 <= status < 500, (status, data)
    assert name not in gw.list_secret_names()
    assert canary.count() == 0, "the gateway connected to the supplied address"


def test_loopback_destination_is_refused():
    canary = gw.Canary()
    try:
        _refused_at_supply(
            gw.unique("loopback"), "openai", {"api_key": "sk-test"},
            {"api_base": f"http://127.0.0.1:{canary.port}/v1"}, canary,
        )
    finally:
        canary.close()


def test_private_network_destination_is_refused():
    canary = gw.Canary()
    try:
        _refused_at_supply(
            gw.unique("private"), "openai", {"api_key": "sk-test"},
            {"api_base": "http://10.1.2.3/v1"}, canary,
        )
    finally:
        canary.close()


def test_link_local_destination_is_refused():
    canary = gw.Canary()
    try:
        _refused_at_supply(
            gw.unique("linklocal"), "openai", {"api_key": "sk-test"},
            {"api_base": "http://169.254.169.254/latest/meta-data"}, canary,
        )
    finally:
        canary.close()


def test_update_cannot_install_an_internal_destination():
    name = gw.unique("update")
    status, data = gw.create_secret(
        name, provider="openai", auth_config={"api_base": "https://8.8.8.8/v1"}
    )
    assert status == 200, data
    secret_id = data["secret"]["secret_id"]

    status, _ = gw.update_secret(secret_id, auth_config={"api_base": "http://127.0.0.1:9/v1"})
    assert 400 <= status < 500

    status, data = gw.get_secret(secret_id)
    assert status == 200, data
    assert data["secret"]["auth_config"]["api_base"] == "https://8.8.8.8/v1"
