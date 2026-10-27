"""Security tests: the client identity behind throttling and audit entries.

Each test drives the real web interface (a real core, the real WSGI application,
the public HTTP routes) in a child process and checks an observable outcome: how
the per-client request budget moves, what the audit entries record, and whether
the local-only endpoints answer.  No product code is imported here, so hardening
the product cannot break the bookkeeping.
"""

from conftest import API_PATH, client_logs, remaining, run_scenario, statuses

API_KEY_HEADERS = {"X-API-Key": "__API_KEY__"}


def _api_get(forwarded=None, remote=None, headers=None):
    merged = dict(API_KEY_HEADERS)
    for key, value in (headers or {}).items():
        merged[key] = value
    if forwarded is not None:
        merged["X-Forwarded-For"] = forwarded
    action = {"path": API_PATH, "headers": merged}
    if remote is not None:
        action["remote"] = remote
    return action


def test_budget_ignores_rotating_forwarded_value():
    """Two requests from one peer must share one budget whatever they claim."""
    result = run_scenario(
        [
            _api_get("10.11.0.1", "198.18.11.1"),
            _api_get("10.11.0.2", "198.18.11.1"),
        ],
        trusted_proxies=0,
    )
    assert statuses(result) == [200, 200], result
    left = remaining(result)
    assert left[0] is not None and left[1] is not None, result
    assert left[1] == left[0] - 1, result


def test_budget_uses_only_the_trusted_hop():
    """Behind one trusted proxy, only the hop it appends may identify the client."""
    result = run_scenario(
        [
            _api_get("10.12.0.1, 203.0.113.5", "198.18.11.2"),
            _api_get("10.12.0.2, 203.0.113.5", "198.18.11.2"),
        ],
        trusted_proxies=1,
    )
    assert statuses(result) == [200, 200], result
    left = remaining(result)
    assert left[0] is not None and left[1] is not None, result
    assert left[1] == left[0] - 1, result


def test_budget_ignores_malformed_forwarded_value():
    """A value that is not an address must not start a new per-client budget."""
    result = run_scenario(
        [
            _api_get("not-an-address", "198.18.11.3"),
            _api_get("also-not-an-address", "198.18.11.3"),
        ],
        trusted_proxies=0,
    )
    assert statuses(result) == [200, 200], result
    left = remaining(result)
    assert left[0] is not None and left[1] is not None, result
    assert left[1] == left[0] - 1, result


def test_unknown_peer_is_still_throttled():
    """A request whose peer cannot be determined must not be exempt from the budget."""
    actions = [{"path": API_PATH, "headers": dict(API_KEY_HEADERS), "remote": None}
               for _ in range(101)]
    result = run_scenario(actions, trusted_proxies=0)
    codes = statuses(result)
    assert codes[0] == 200, result
    assert 400 <= codes[-1] < 500, result


def test_api_key_audit_records_the_peer():
    marker, peer = "203.0.113.71", "198.18.11.4"
    result = run_scenario(
        [
            {
                "path": API_PATH,
                "headers": {"X-API-Key": "pl_invalid_key", "X-Forwarded-For": marker},
                "remote": peer,
            }
        ],
        trusted_proxies=0,
    )
    entries = "\n".join(result.get("logs", []))
    assert marker not in entries, entries
    assert peer in entries, entries


def test_login_audit_records_the_peer():
    marker, peer = "203.0.113.72", "198.18.11.5"
    result = run_scenario(
        [
            {
                "method": "POST",
                "path": "/login",
                "data": {"username": "pyload", "password": "deliberately-wrong"},
                "headers": {"X-Forwarded-For": marker},
                "remote": peer,
            }
        ],
        trusted_proxies=0,
    )
    entries = "\n".join(result.get("logs", []))
    assert marker not in entries, entries
    assert peer in entries, entries


def test_login_audit_uses_only_the_trusted_hop():
    """An audit entry behind one trusted proxy records the hop, not a client-supplied prefix."""
    marker, real, peer = "10.13.0.1", "203.0.113.80", "198.18.11.8"
    result = run_scenario(
        [
            {
                "method": "POST",
                "path": "/login",
                "data": {"username": "pyload", "password": "deliberately-wrong"},
                "headers": {"X-Forwarded-For": "%s, %s" % (marker, real)},
                "remote": peer,
            }
        ],
        trusted_proxies=1,
    )
    entries = "\n".join(result.get("logs", []))
    assert marker not in entries, entries
    assert real in entries, entries


def test_web_client_audit_records_the_peer():
    marker, peer = "203.0.113.73", "198.18.11.6"
    result = run_scenario(
        [
            {
                "path": "/json/status",
                "headers": {"X-Forwarded-For": marker},
                "remote": peer,
            }
        ],
        trusted_proxies=0,
    )
    entries = "\n".join(result.get("logs", []))
    assert marker not in entries, entries
    assert peer in entries, entries


def test_documentation_audit_records_the_peer():
    marker, peer = "203.0.113.74", "198.18.11.7"
    result = run_scenario(
        [
            {
                "path": "/api/openapi.json",
                "headers": {
                    "Authorization": "Basic cHlsb2FkOmRlbGliZXJhdGVseS13cm9uZw==",
                    "X-Forwarded-For": marker,
                },
                "remote": peer,
            }
        ],
        trusted_proxies=0,
    )
    entries = "\n".join(result.get("logs", []))
    assert marker not in entries, entries
    assert peer in entries, entries


def test_local_endpoint_rejects_forwarded_loopback():
    """A remote peer claiming a loopback address must not reach the local-only endpoints."""
    result = run_scenario(
        [
            {
                "path": "/jdcheck.js",
                "base_url": "http://localhost:9666",
                "headers": {"X-Forwarded-For": "127.0.0.1"},
                "remote": "203.0.113.10",
            }
        ],
        trusted_proxies=1,
        enable_clicknload=True,
    )
    assert len(statuses(result)) == 1, result
    assert 400 <= statuses(result)[0] < 500, result


def test_negative_trusted_proxy_count_prevents_start():
    result = run_scenario([], trusted_proxies=-1)
    assert "build_error" in result, result
