"""Security suite: requests must only be served for an allowed host identity."""
from __future__ import annotations

from urllib.parse import urlsplit

import pytest

from support.apps import SERVED_MARKER, make_app
from support.hostclient import serve

ALLOWED = ["ok.example.com", "*.example.com", "www.moishe.zuchmir.com"]
DISALLOWED = "evil.example.net"


def _assert_no_handler(resp) -> None:
    assert SERVED_MARKER not in resp.text, "the application handler ran for an untrusted host"


def _assert_client_error(resp) -> None:
    _assert_no_handler(resp)
    assert 400 <= resp.status < 500, f"expected a client error, got {resp.status}: {resp.text[:160]}"


def _assert_redirect_on_allowed(resp, allowed_hosts) -> None:
    _assert_no_handler(resp)
    if 400 <= resp.status < 500:
        return
    assert 300 <= resp.status < 400, f"expected a redirect or a refusal, got {resp.status}"
    location = resp.header("location")
    assert location, "a redirect must name a location"
    assert (urlsplit(location).hostname or "") in allowed_hosts, f"redirected to {location!r}"


def test_forwarded_host_cannot_stand_in_for_the_host() -> None:
    """A forwarded-host header must not become the host when the request carries none."""
    with serve(make_app(["ok.example.com"])) as server:
        resp = server.request(
            host=None,
            version="HTTP/1.0",
            headers={"X-Forwarded-Host": "ok.example.com"},
        )
    _assert_client_error(resp)


@pytest.mark.parametrize(
    "presented",
    [
        "ok.example.com:80@evil.example.net",
        "ok.example.com:443@evil.example.net",
    ],
)
def test_authority_prefix_cannot_extend_the_host(presented: str) -> None:
    """A value whose authority designates another name is not the allowed name it starts with."""
    with serve(make_app(["ok.example.com"])) as server:
        resp = server.request(host=presented)
    _assert_client_error(resp)


def test_redirect_target_cannot_be_the_attacker_host() -> None:
    """A redirect must not point the client at a host outside the allowed set."""
    with serve(make_app(["www.moishe.zuchmir.com"])) as server:
        resp = server.request(host="moishe.zuchmir.com:80@evil.example.net")
    _assert_redirect_on_allowed(resp, ["www.moishe.zuchmir.com"])


def test_routing_errors_get_the_same_refusal() -> None:
    """An untrusted host is refused the same way whatever else the request carries."""
    with serve(make_app(ALLOWED)) as server:
        baseline = server.request(host=DISALLOWED)
        unknown_path = server.request(host=DISALLOWED, target="/no-such-path")
        wrong_method = server.request(method="POST", host=DISALLOWED, target="/")
    _assert_client_error(baseline)
    assert (unknown_path.status, unknown_path.body) == (baseline.status, baseline.body)
    assert (wrong_method.status, wrong_method.body) == (baseline.status, baseline.body)


def test_forwarded_host_cannot_choose_the_redirect_target() -> None:
    """A forwarded-host header must not decide where the client is sent."""
    with serve(make_app(["www.moishe.zuchmir.com"])) as server:
        resp = server.request(host="moishe.zuchmir.com", headers={"X-Forwarded-Host": "evil.example.net"})
    _assert_redirect_on_allowed(resp, ["www.moishe.zuchmir.com"])


def test_forwarded_host_cannot_change_the_url_the_app_builds() -> None:
    """No address the application derives from the request may name another host."""
    with serve(make_app(["ok.example.com"])) as server:
        resp = server.request(
            target="/echo-url",
            host="ok.example.com",
            headers={"X-Forwarded-Host": "evil.example.net"},
        )
    if 400 <= resp.status < 500:
        _assert_no_handler(resp)
        return
    assert resp.status == 200, resp.text[:160]
    assert "evil.example.net" not in resp.text
    payload = resp.json()
    assert urlsplit(payload["url"]).hostname == "ok.example.com"
    assert urlsplit(payload["base_url"]).hostname == "ok.example.com"
