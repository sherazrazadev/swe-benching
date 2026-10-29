"""A parameter repeated in the request must not smuggle a second redirect target."""

from urllib.parse import quote

from oauth_harness import Client
from oauth_harness import build_app

from expectations import ATTACKER
from expectations import assert_refused

REGISTERED = "https://client-a.invalid/callback"


def _authorize_url(first_redirect_uri, second_redirect_uri):
    return (
        "/oauth/authorize"
        "?response_type=code"
        "&client_id=client-a"
        f"&redirect_uri={quote(first_redirect_uri, safe='')}"
        f"&redirect_uri={quote(second_redirect_uri, safe='')}"
        "&scope=profile"
        "&state=r1"
    )


def test_repeated_redirect_uri_does_not_redirect_to_the_unregistered_value():
    app, server = build_app({"client-a": Client("client-a", [REGISTERED])})
    rv = app.test_client().get(_authorize_url(ATTACKER, REGISTERED))
    assert_refused(rv, server)
