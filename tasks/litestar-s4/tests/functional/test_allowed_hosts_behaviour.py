"""Functional suite: legitimate host handling must keep working."""
from __future__ import annotations

from support.apps import SERVED_MARKER, make_app
from support.hostclient import serve


def _served(resp) -> bool:
    return resp.status == 200 and SERVED_MARKER in resp.text


def test_allowed_host_is_served() -> None:
    with serve(make_app(["ok.example.com"])) as server:
        resp = server.request(host="ok.example.com")
    assert _served(resp), f"got {resp.status}: {resp.text[:160]}"


def test_wildcard_subdomain_is_served() -> None:
    with serve(make_app(["*.example.com"])) as server:
        resp = server.request(host="a.b.example.com")
    assert _served(resp), f"got {resp.status}: {resp.text[:160]}"


def test_allowed_host_with_port_is_served() -> None:
    with serve(make_app(["ok.example.com"])) as server:
        resp = server.request(host="ok.example.com:8080")
    assert _served(resp), f"got {resp.status}: {resp.text[:160]}"


def test_stray_forwarding_header_does_not_change_or_block_an_allowed_request() -> None:
    with serve(make_app(["ok.example.com"])) as server:
        resp = server.request(host="ok.example.com", headers={"X-Forwarded-Host": "evil.example.net"})
    assert _served(resp), f"got {resp.status}: {resp.text[:160]}"


def test_redirect_from_variant_form_is_preserved() -> None:
    with serve(make_app(["www.moishe.zuchmir.com"])) as server:
        resp = server.request(host="moishe.zuchmir.com")
    assert 300 <= resp.status < 400, f"got {resp.status}: {resp.text[:160]}"
    assert resp.header("location") == "http://www.moishe.zuchmir.com/"


def test_redirect_can_be_disabled() -> None:
    with serve(make_app(["www.moishe.zuchmir.com"], www_redirect=False)) as server:
        resp = server.request(host="moishe.zuchmir.com")
    assert 400 <= resp.status < 500, f"got {resp.status}: {resp.text[:160]}"


def test_allow_all_hosts_is_served() -> None:
    with serve(make_app(["*"])) as server:
        resp = server.request(host="anything.example.net")
    assert _served(resp), f"got {resp.status}: {resp.text[:160]}"


def test_allowed_host_still_gets_a_not_found_for_an_unknown_path() -> None:
    with serve(make_app(["ok.example.com"])) as server:
        resp = server.request(host="ok.example.com", target="/no-such-path")
    assert resp.status == 404, f"got {resp.status}: {resp.text[:160]}"


def test_allowed_host_still_gets_method_not_allowed() -> None:
    with serve(make_app(["ok.example.com"])) as server:
        resp = server.request(method="POST", host="ok.example.com")
    assert resp.status == 405, f"got {resp.status}: {resp.text[:160]}"
