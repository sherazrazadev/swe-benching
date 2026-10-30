import pytest

from _support import Proxy


def test_native_client_without_origin_is_allowed(monkeypatch):
    proxy = Proxy(monkeypatch)
    assert proxy.outcome("/v1/responses") == "accepted"
    assert proxy.dialed >= 1


def test_native_client_without_origin_allowed_on_codex_alias(monkeypatch):
    proxy = Proxy(monkeypatch)
    assert proxy.outcome("/v1/codex/responses") == "accepted"


def test_native_client_without_origin_allowed_on_legacy_relay(monkeypatch):
    proxy = Proxy(monkeypatch)
    assert proxy.outcome("/v1/responses/legacy") == "accepted"


def test_native_client_without_origin_allowed_on_local_relay(monkeypatch):
    proxy = Proxy(monkeypatch)
    assert proxy.outcome("/internal/responses-relay", host="127.0.0.1:8787") == "accepted"


@pytest.mark.parametrize(
    "origin",
    [
        "http://localhost:5173",
        "https://127.0.0.1:8787",
        "http://[::1]:3000",
        "http://localhost",
    ],
)
def test_local_origin_is_allowed(origin, monkeypatch):
    proxy = Proxy(monkeypatch)
    assert proxy.outcome("/v1/responses", origin=origin) == "accepted"
    assert proxy.dialed >= 1


def test_configured_origin_is_allowed(monkeypatch):
    proxy = Proxy(monkeypatch, env={"HEADROOM_CORS_ORIGINS": "https://dash.example.com"})
    assert proxy.outcome("/v1/responses", origin="https://dash.example.com") == "accepted"
    assert proxy.dialed >= 1


def test_configured_origin_list_is_allowed(monkeypatch):
    proxy = Proxy(
        monkeypatch,
        env={"HEADROOM_CORS_ORIGINS": "https://one.example.com, https://two.example.com"},
    )
    assert proxy.outcome("/v1/responses", origin="https://two.example.com") == "accepted"


def test_wildcard_configuration_allows_a_remote_origin(monkeypatch):
    proxy = Proxy(monkeypatch, env={"HEADROOM_CORS_ORIGINS": "*"})
    assert proxy.outcome("/v1/responses", origin="https://remote.example") == "accepted"
