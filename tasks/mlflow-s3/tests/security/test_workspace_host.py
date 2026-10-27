import gwhelper as gw


def test_workspace_host_destination_is_refused():
    canary = gw.Canary()
    try:
        name = gw.unique("workspace")
        status, data = gw.create_secret(
            name,
            provider="databricks",
            secret_value={"api_key": "dapi-test"},
            auth_config={"api_base": f"http://127.0.0.1:{canary.port}"},
        )
        assert 400 <= status < 500, (status, data)
        assert name not in gw.list_secret_names()
        assert canary.count() == 0, "a workspace client contacted the supplied address"
    finally:
        canary.close()
