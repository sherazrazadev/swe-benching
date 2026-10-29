"""Signed request-object deployments: an error raised while the request is rewritten."""

from oauth_harness import Client
from oauth_harness import RequestObjectExtension
from oauth_harness import build_app
from oauth_harness import sign_request_object

from expectations import ATTACKER
from expectations import assert_refused

REGISTERED = "https://client-a.invalid/callback"


def test_request_object_claim_is_not_used_as_a_redirect_target():
    app, server = build_app(
        {"client-a": Client("client-a", [REGISTERED])},
        [RequestObjectExtension.make()],
    )
    request_object = sign_request_object(
        {
            "response_type": "code",
            "client_id": "client-a",
            "redirect_uri": ATTACKER,
        }
    )
    rv = app.test_client().get(
        "/oauth/authorize",
        query_string={
            "client_id": "client-a",
            "redirect_uri": REGISTERED,
            "request": request_object,
        },
    )
    assert_refused(rv, server)
