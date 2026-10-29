"""Uncovered routes: the OpenID Connect grant error paths on the same endpoint."""

from oauth_harness import Client
from oauth_harness import build_app

from expectations import ATTACKER
from expectations import assert_refused

REGISTERED = "https://openid-client.invalid/callback"

OIDC_RESPONSE_TYPES = [
    "id_token",
    "id_token token",
    "code id_token",
    "code token",
    "code id_token token",
]


def _server():
    client = Client(
        "openid-client",
        [REGISTERED],
        response_types=OIDC_RESPONSE_TYPES,
        scope="openid profile",
    )
    return build_app({"openid-client": client})


def test_implicit_flow_error_does_not_use_unregistered_uri():
    app, server = _server()
    rv = app.test_client().post(
        "/oauth/authorize",
        data={
            "response_type": "id_token",
            "client_id": "openid-client",
            "scope": "profile",
            "state": "o1",
            "nonce": "nonce-1",
            "redirect_uri": ATTACKER,
        },
    )
    assert_refused(rv, server)


def test_implicit_flow_error_does_not_use_unknown_client():
    app, server = _server()
    rv = app.test_client().post(
        "/oauth/authorize",
        data={
            "response_type": "id_token",
            "client_id": "ghost-client",
            "scope": "profile",
            "state": "o2",
            "nonce": "nonce-2",
            "redirect_uri": ATTACKER,
        },
    )
    assert_refused(rv, server)


def test_implicit_flow_error_without_client_is_not_redirected():
    app, server = _server()
    rv = app.test_client().post(
        "/oauth/authorize",
        data={
            "response_type": "id_token",
            "scope": "profile",
            "state": "o3",
            "nonce": "nonce-3",
            "redirect_uri": ATTACKER,
        },
    )
    assert_refused(rv, server)


def test_hybrid_flow_error_does_not_use_unregistered_uri():
    app, server = _server()
    rv = app.test_client().post(
        "/oauth/authorize",
        data={
            "response_type": "code id_token",
            "client_id": "openid-client",
            "scope": "profile",
            "state": "o4",
            "nonce": "nonce-4",
            "redirect_uri": ATTACKER,
        },
    )
    assert_refused(rv, server)


def test_hybrid_flow_error_does_not_use_unknown_client():
    app, server = _server()
    rv = app.test_client().post(
        "/oauth/authorize",
        data={
            "response_type": "code id_token",
            "client_id": "ghost-client",
            "scope": "profile",
            "state": "o5",
            "nonce": "nonce-5",
            "redirect_uri": ATTACKER,
        },
    )
    assert_refused(rv, server)
