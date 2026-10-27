"""Functional tests: behaviour that must keep working.

These are ordinary, legitimate uses of the web interface.  They pass on the
vulnerable code as well, so a fix that removes throttling, removes the audit
entries, refuses local use, or breaks a deployment behind a reverse proxy fails
here.
"""

from conftest import API_PATH, client_logs, remaining, run_scenario, statuses

API_KEY_HEADERS = {"X-API-Key": "__API_KEY__"}


def _api_get(forwarded=None, remote=None):
    headers = dict(API_KEY_HEADERS)
    if forwarded is not None:
        headers["X-Forwarded-For"] = forwarded
    action = {"path": API_PATH, "headers": headers}
    if remote is not None:
        action["remote"] = remote
    return action


def test_each_peer_has_its_own_budget():
    result = run_scenario(
        [
            _api_get(remote="198.18.21.1"),
            _api_get(remote="198.18.21.1"),
            _api_get(remote="198.18.21.2"),
        ],
        trusted_proxies=0,
    )
    assert statuses(result) == [200, 200, 200], result
    left = remaining(result)
    assert left[0] is not None, result
    assert left[1] == left[0] - 1, result
    assert left[2] == left[0], result


def test_reverse_proxy_deployment_keeps_per_client_identity():
    """Behind one trusted proxy, distinct real clients keep distinct budgets and identities."""
    result = run_scenario(
        [
            _api_get("198.51.100.1", "198.18.21.3"),
            _api_get("198.51.100.2", "198.18.21.3"),
            {
                "method": "POST",
                "path": "/login",
                "data": {"username": "pyload", "password": "deliberately-wrong"},
                "headers": {"X-Forwarded-For": "198.51.100.9"},
                "remote": "198.18.21.3",
            },
        ],
        trusted_proxies=1,
    )
    assert statuses(result)[:2] == [200, 200], result
    left = remaining(result)
    assert left[0] is not None and left[1] is not None, result
    assert left[1] == left[0], result
    entries = "\n".join(client_logs(result))
    assert "198.51.100.9" in entries, entries


def test_local_peer_reaches_local_endpoint_with_trusted_proxy():
    result = run_scenario(
        [
            {
                "path": "/jdcheck.js",
                "base_url": "http://localhost:9666",
                "remote": "127.0.0.1",
            }
        ],
        trusted_proxies=1,
        enable_clicknload=True,
    )
    assert statuses(result) == [200], result


def test_local_peer_reaches_local_endpoint_by_default():
    result = run_scenario(
        [
            {
                "path": "/jdcheck.js",
                "base_url": "http://localhost:9666",
                "remote": "127.0.0.1",
            }
        ],
        trusted_proxies=0,
        enable_clicknload=True,
    )
    assert statuses(result) == [200], result


def test_audit_entries_are_still_written():
    peer = "198.18.21.4"
    result = run_scenario(
        [
            {
                "path": API_PATH,
                "headers": {"X-API-Key": "pl_invalid_key"},
                "remote": peer,
            },
            {
                "method": "POST",
                "path": "/login",
                "data": {"username": "pyload", "password": "deliberately-wrong"},
                "remote": peer,
            },
            {"path": "/json/status", "remote": peer},
            {
                "path": "/api/openapi.json",
                "headers": {
                    "Authorization": "Basic cHlsb2FkOmRlbGliZXJhdGVseS13cm9uZw=="
                },
                "remote": peer,
            },
        ],
        trusted_proxies=0,
    )
    entries = client_logs(result)
    assert len(entries) >= 4, entries
    assert all(peer in line for line in entries), entries


def test_authenticated_request_still_works():
    result = run_scenario([_api_get(remote="198.18.21.5")], trusted_proxies=0)
    assert statuses(result) == [200], result
    assert remaining(result)[0] is not None, result
