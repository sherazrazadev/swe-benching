"""The reported path: an unsupported response type on the authorization endpoint."""

from oauth_harness import Client
from oauth_harness import build_app

from expectations import ATTACKER
from expectations import assert_refused

REGISTERED = "https://client-a.invalid/callback"
OTHER_REGISTERED = "https://client-a.invalid/second"
CLIENT_B_CALLBACK = "https://client-b.invalid/callback"


def _server(clients):
    return build_app(clients)


def test_unregistered_redirect_uri_is_not_used():
    app, server = _server(
        {"client-a": Client("client-a", [REGISTERED, OTHER_REGISTERED])}
    )
    rv = app.test_client().post(
        "/oauth/authorize",
        data={
            "response_type": "totally-unsupported",
            "client_id": "client-a",
            "redirect_uri": ATTACKER,
            "state": "s1",
        },
    )
    assert_refused(rv, server)


def test_unknown_client_is_not_redirected():
    app, server = _server(
        {"client-a": Client("client-a", [REGISTERED])}
    )
    rv = app.test_client().post(
        "/oauth/authorize",
        data={
            "response_type": "totally-unsupported",
            "client_id": "client-that-does-not-exist",
            "redirect_uri": ATTACKER,
            "state": "s2",
        },
    )
    assert_refused(rv, server)


def test_request_without_a_client_is_not_redirected():
    app, server = _server(
        {"client-a": Client("client-a", [REGISTERED])}
    )
    rv = app.test_client().post(
        "/oauth/authorize",
        data={
            "response_type": "totally-unsupported",
            "redirect_uri": ATTACKER,
            "state": "s3",
        },
    )
    assert_refused(rv, server)


def test_another_clients_registered_uri_is_not_used():
    app, server = _server(
        {
            "client-a": Client("client-a", [REGISTERED]),
            "client-b": Client("client-b", [CLIENT_B_CALLBACK]),
        }
    )
    rv = app.test_client().post(
        "/oauth/authorize",
        data={
            "response_type": "totally-unsupported",
            "client_id": "client-a",
            "redirect_uri": CLIENT_B_CALLBACK,
            "state": "s4",
        },
    )
    assert_refused(rv, server)
