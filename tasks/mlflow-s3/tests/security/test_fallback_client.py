import gwhelper as gw


def _refused_at_supply(name, provider, secret_value, auth_config, canary):
    status, data = gw.create_secret(
        name, secret_value=secret_value, provider=provider, auth_config=auth_config
    )
    assert 400 <= status < 500, (status, data)
    assert name not in gw.list_secret_names()
    assert canary.count() == 0, "a supplied value reached the internal address"


def test_merged_secret_value_cannot_set_the_destination():
    canary = gw.Canary()
    try:
        _refused_at_supply(
            gw.unique("merged"),
            "cohere",
            {"api_key": "sk-test", "api_base": f"http://127.0.0.1:{canary.port}/v1"},
            {"api_base": "https://8.8.8.8/v1"},
            canary,
        )
    finally:
        canary.close()


def test_opt_in_warm_up_cannot_reach_an_internal_destination():
    canary = gw.Canary()
    try:
        _refused_at_supply(
            gw.unique("warmup"),
            "cohere",
            {"api_key": "sk-test"},
            {"api_base": f"http://127.0.0.1:{canary.port}/v1", "warm_up": "true"},
            canary,
        )
    finally:
        canary.close()
