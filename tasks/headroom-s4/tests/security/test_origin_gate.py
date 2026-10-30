import pytest

from _support import Proxy

REMOTE = "https://remote.example"

# Every upgrade entry the product registers for the Responses relay.
ENTRIES = [
    "/v1/responses",
    "/v1/codex/responses",
    "/backend-api/responses",
    "/backend-api/codex/responses",
]


@pytest.mark.parametrize("path", ENTRIES)
def test_remote_origin_refused_on_each_entry(path, monkeypatch):
    proxy = Proxy(monkeypatch)
    assert proxy.outcome(path, origin=REMOTE) == "refused"
    assert proxy.dialed == 0


def test_remote_origin_refused_on_legacy_relay(monkeypatch):
    proxy = Proxy(monkeypatch)
    assert proxy.outcome("/v1/responses/legacy", origin=REMOTE) == "refused"
    assert proxy.dialed == 0


def test_remote_origin_refused_on_local_relay(monkeypatch):
    proxy = Proxy(monkeypatch)
    assert (
        proxy.outcome("/internal/responses-relay", origin=REMOTE, host="127.0.0.1:8787")
        == "refused"
    )
    assert proxy.dialed == 0


def test_refused_origin_opens_no_upstream_session(monkeypatch):
    proxy = Proxy(monkeypatch)
    proxy.outcome("/v1/responses", origin=REMOTE)
    assert proxy.dialed == 0


def test_hostname_containing_loopback_name_is_refused(monkeypatch):
    proxy = Proxy(monkeypatch)
    assert proxy.outcome("/v1/responses", origin="http://localhost.evil.example") == "refused"
    assert proxy.dialed == 0


def test_hostname_containing_loopback_address_is_refused(monkeypatch):
    proxy = Proxy(monkeypatch)
    assert proxy.outcome("/v1/responses", origin="http://127.0.0.1.evil.example") == "refused"
    assert proxy.dialed == 0


def test_opaque_origin_is_refused(monkeypatch):
    proxy = Proxy(monkeypatch)
    assert proxy.outcome("/v1/responses", origin="null") == "refused"
    assert proxy.dialed == 0


def test_unparseable_origin_is_refused(monkeypatch):
    proxy = Proxy(monkeypatch)
    assert proxy.outcome("/v1/responses", origin="http://") == "refused"
    assert proxy.dialed == 0


def test_unlisted_origin_refused_when_explicit_list_configured(monkeypatch):
    proxy = Proxy(monkeypatch, env={"HEADROOM_CORS_ORIGINS": "https://dash.example.com"})
    assert proxy.outcome("/v1/responses", origin="https://other.example") == "refused"
    assert proxy.dialed == 0
