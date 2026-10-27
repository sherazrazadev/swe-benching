import gwhelper as gw


def test_location_value_cannot_rewrite_the_host():
    canary = gw.Canary()
    try:
        name = gw.unique("location")
        status, data = gw.create_secret(
            name,
            provider="vertex_ai",
            secret_value={"api_key": "test-key", "vertex_credentials": "{}"},
            auth_config={
                "vertex_project": "test-project",
                "vertex_location": f"127.0.0.1:{canary.port}/#",
            },
        )
        assert 400 <= status < 500, (status, data)
        assert name not in gw.list_secret_names()
        assert canary.count() == 0
    finally:
        canary.close()


def test_region_value_cannot_rewrite_the_host():
    canary = gw.Canary()
    try:
        name = gw.unique("region")
        status, data = gw.create_secret(
            name,
            provider="bedrock",
            secret_value={"api_key": "test-key"},
            auth_config={
                "auth_mode": "api_key",
                "aws_region_name": f"a@127.0.0.1:{canary.port}",
            },
        )
        assert 400 <= status < 500, (status, data)
        assert name not in gw.list_secret_names()
        assert canary.count() == 0
    finally:
        canary.close()
