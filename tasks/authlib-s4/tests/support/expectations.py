"""Expectation helpers shared by the hidden suites (stdlib only)."""

from urllib.parse import parse_qs
from urllib.parse import urlparse

ATTACKER = "https://attacker.invalid/landing"
SECOND_ATTACKER = "https://second-attacker.invalid/landing"


def assert_client_error(rv):
    """The request is refused with a client error; nothing is redirected."""
    assert 400 <= rv.status_code < 500, (
        f"expected a client error, got {rv.status_code}: {rv.data[:200]!r}"
    )
    location = rv.headers.get("Location")
    assert location is None, f"refused request still redirected to {location!r}"


def assert_no_side_effect(server):
    assert server.issued_codes == [], f"authorization code issued: {server.issued_codes!r}"
    assert server.issued_tokens == [], f"token issued: {server.issued_tokens!r}"


def assert_refused(rv, server=None):
    assert_client_error(rv)
    if server is not None:
        assert_no_side_effect(server)


def redirect_target(rv):
    location = rv.headers.get("Location")
    assert location, f"expected a redirect, got status {rv.status_code}"
    parsed = urlparse(location)
    base = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    params = parse_qs(parsed.query)
    if parsed.fragment:
        params.update(parse_qs(parsed.fragment))
    return base, params


def assert_error_redirect(rv, target, error_code=None):
    base, params = redirect_target(rv)
    assert base == target, f"redirected to {base!r}, expected {target!r}"
    if error_code is not None:
        assert params.get("error") == [error_code], (
            f"expected error={error_code!r} at {target!r}, got {params!r}"
        )
    return params
