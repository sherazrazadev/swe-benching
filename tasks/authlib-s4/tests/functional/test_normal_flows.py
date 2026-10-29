"""Successful authorization flows keep working exactly as before."""

from oauth_harness import Client
from oauth_harness import RequestObjectExtension
from oauth_harness import build_app
from oauth_harness import sign_request_object

from expectations import redirect_target

REGISTERED = "https://client-a.invalid/callback"
OIDC_REGISTERED = "https://openid-client.invalid/callback"


def test_authorization_code_flow_issues_a_code():
    app, server = build_app({"client-a": Client("client-a", [REGISTERED])})
    rv = app.test_client().post(
        "/oauth/authorize",
        data={
            "response_type": "code",
            "client_id": "client-a",
            "redirect_uri": REGISTERED,
            "scope": "profile",
            "state": "n1",
            "user_id": "1",
        },
    )
    base, params = redirect_target(rv)
    assert base == REGISTERED
    assert params.get("state") == ["n1"]
    assert params.get("code")
    assert len(server.issued_codes) == 1


def test_implicit_flow_issues_an_access_token():
    app, server = build_app({"client-a": Client("client-a", [REGISTERED])})
    rv = app.test_client().post(
        "/oauth/authorize",
        data={
            "response_type": "token",
            "client_id": "client-a",
            "redirect_uri": REGISTERED,
            "scope": "profile",
            "state": "n2",
            "user_id": "1",
        },
    )
    base, params = redirect_target(rv)
    assert base == REGISTERED
    assert params.get("access_token")
    assert len(server.issued_tokens) == 1


def test_openid_implicit_flow_issues_an_id_token():
    client = Client(
        "openid-client",
        [OIDC_REGISTERED],
        response_types=["id_token", "id_token token"],
        scope="openid profile",
    )
    app, server = build_app({"openid-client": client})
    rv = app.test_client().post(
        "/oauth/authorize",
        data={
            "response_type": "id_token",
            "client_id": "openid-client",
            "scope": "openid profile",
            "state": "n3",
            "nonce": "nonce-n3",
            "redirect_uri": OIDC_REGISTERED,
            "user_id": "1",
        },
    )
    base, params = redirect_target(rv)
    assert base == OIDC_REGISTERED
    assert params.get("id_token")
    assert params.get("state") == ["n3"]


def test_openid_hybrid_flow_issues_a_code_and_an_id_token():
    client = Client(
        "openid-client",
        [OIDC_REGISTERED],
        response_types=["code id_token", "code token", "code id_token token"],
        scope="openid profile",
    )
    app, server = build_app({"openid-client": client})
    rv = app.test_client().post(
        "/oauth/authorize",
        data={
            "response_type": "code id_token",
            "client_id": "openid-client",
            "scope": "openid profile",
            "state": "n4",
            "nonce": "nonce-n4",
            "redirect_uri": OIDC_REGISTERED,
            "user_id": "1",
        },
    )
    base, params = redirect_target(rv)
    assert base == OIDC_REGISTERED
    assert params.get("code")
    assert params.get("id_token")
    assert len(server.issued_codes) == 1


def test_request_object_deployment_still_authorizes():
    app, server = build_app(
        {"client-a": Client("client-a", [REGISTERED])},
        [RequestObjectExtension.make()],
    )
    request_object = sign_request_object(
        {
            "response_type": "code",
            "client_id": "client-a",
            "redirect_uri": REGISTERED,
        }
    )
    client = app.test_client()
    consent = client.get(
        "/oauth/authorize",
        query_string={
            "client_id": "client-a",
            "redirect_uri": REGISTERED,
            "request": request_object,
        },
    )
    assert consent.status_code == 200
    assert consent.data == b"ok"

    rv = client.post(
        "/oauth/authorize",
        data={
            "client_id": "client-a",
            "redirect_uri": REGISTERED,
            "request": request_object,
            "user_id": "1",
        },
    )
    base, params = redirect_target(rv)
    assert base == REGISTERED
    assert params.get("code")


def test_request_object_without_outer_redirect_uri_still_authorizes():
    app, server = build_app(
        {"client-a": Client("client-a", [REGISTERED])},
        [RequestObjectExtension.make()],
    )
    request_object = sign_request_object(
        {
            "response_type": "code",
            "client_id": "client-a",
            "redirect_uri": REGISTERED,
        }
    )
    rv = app.test_client().post(
        "/oauth/authorize",
        data={
            "client_id": "client-a",
            "request": request_object,
            "user_id": "1",
        },
    )
    base, params = redirect_target(rv)
    assert base == REGISTERED
    assert params.get("code")
