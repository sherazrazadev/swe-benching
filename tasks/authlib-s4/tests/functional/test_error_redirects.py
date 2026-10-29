"""Behaviour that must keep working: registered clients still receive error redirects."""

from oauth_harness import Client
from oauth_harness import build_app

from expectations import assert_error_redirect

REGISTERED = "https://client-a.invalid/callback"
SECOND_REGISTERED = "https://client-a.invalid/second"
OIDC_REGISTERED = "https://openid-client.invalid/callback"


def test_unsupported_response_type_still_reaches_the_registered_uri():
    app, server = build_app({"client-a": Client("client-a", [REGISTERED])})
    rv = app.test_client().post(
        "/oauth/authorize",
        data={
            "response_type": "totally-unsupported",
            "client_id": "client-a",
            "redirect_uri": REGISTERED,
            "state": "f1",
        },
    )
    params = assert_error_redirect(rv, REGISTERED, "unsupported_response_type")
    assert params.get("state") == ["f1"]


def test_unsupported_response_type_reaches_a_non_default_registered_uri():
    app, server = build_app(
        {"client-a": Client("client-a", [REGISTERED, SECOND_REGISTERED])}
    )
    rv = app.test_client().post(
        "/oauth/authorize",
        data={
            "response_type": "totally-unsupported",
            "client_id": "client-a",
            "redirect_uri": SECOND_REGISTERED,
            "state": "f2",
        },
    )
    assert_error_redirect(rv, SECOND_REGISTERED, "unsupported_response_type")


def test_client_not_allowed_that_response_type_still_reaches_the_registered_uri():
    app, server = build_app(
        {"client-a": Client("client-a", [REGISTERED], response_types=["code"])}
    )
    rv = app.test_client().post(
        "/oauth/authorize",
        data={
            "response_type": "token",
            "client_id": "client-a",
            "redirect_uri": REGISTERED,
            "state": "f3",
        },
    )
    assert_error_redirect(rv, REGISTERED, "unauthorized_client")


def test_implicit_scope_error_still_reaches_the_registered_uri():
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
            "scope": "profile",
            "state": "f4",
            "nonce": "nonce-f4",
            "redirect_uri": OIDC_REGISTERED,
        },
    )
    assert_error_redirect(rv, OIDC_REGISTERED, "invalid_scope")


def test_hybrid_scope_error_still_reaches_the_registered_uri():
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
            "scope": "profile",
            "state": "f5",
            "nonce": "nonce-f5",
            "redirect_uri": OIDC_REGISTERED,
        },
    )
    assert_error_redirect(rv, OIDC_REGISTERED, "invalid_scope")
