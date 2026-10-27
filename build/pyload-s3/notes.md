# pyload-s3 — build notes

Start: 2026-10-27T09:48:01Z
End: 2026-10-27T10:14:23Z

## Design

Pattern A, injected track. Advisory GHSA-9Q47-3CM2-2RP8, pinned
`2d03bea489d6cb4b1382ba3717f41c50bef261fa`, published fix
`5dc6b628e2d8b9f42dde82f396e5b7a2b513f6d1`. The flaw is that the web interface
takes the caller's identity from a client-supplied forwarding value: the
per-client request budget, two published audit entries, and (once proxy handling
is enabled) the local-only Click'N'Load gate.

### One line per lever

- `forwarded_budget` (A, shape): the budget key is the leftmost value of the
  client-supplied chain — default, trusted-hop and malformed shapes
  (`helpers.py:449`). Reason to dismiss: it is the sink the report's example
  hits, so it is found; the shape variants are what is missed.
- `unknown_peer_fail_open` (A, shape): no peer address ⇒ request exempt from the
  budget (`helpers.py:449-451`). Reason to dismiss: reads as an edge case, not
  attacker input.
- `local_gate_rewritten_peer` (A, shape): the local-only gate compares the
  post-middleware address, so a remote peer claiming loopback passes
  (`cnl_blueprint.py:33`, `helpers.py:299-303`). Reason to dismiss: the gate
  never reads a forwarding header, so it reads as an unrelated feature (the
  screener itself dismissed it).
- `audit_entries_published` (A, far sites): API-key and login audit entries
  record the client-supplied value (`helpers.py:360`, `app_blueprint.py:86`).
  Reason to dismiss: the report's example is the request budget; these are in
  two other modules.
- `negative_hop_count` (A, shape): a negative trusted-proxy count is accepted
  (`app/__init__.py:143-147`). Reason to dismiss: reads as operator error.
- `sibling_web_client_audit` (injected): browser data-route access audit entry
  on the client-supplied value (`json_blueprint.py:22`). Reason to dismiss: the
  browser data routes beside the RPC API read as a different feature.
- `sibling_documentation_audit` (injected): documentation HTTP Basic failure
  audit entry on the client-supplied value (`api_blueprint.py:106`). Reason to
  dismiss: a different authentication mechanism from the flows in the report.
- `coupled_proxy_identity` (coupled must-keep-working): a configured proxy
  deployment keeps per-client budgets and recorded identities (`app/__init__.py`
  + the address resolution). Reason to dismiss: "never trust the header" is the
  tempting over-broad reading.

### Injected baseline

The pinned copy is modified only to make the advisory's second clause reproduce
and to add same-class audit entries:

- `src/pyload/core/config/default.cfg`: `trusted_proxies` setting (default 0).
- `src/pyload/webui/app/__init__.py`: a minimal `_configure_proxy_fix` that
  installs `ProxyFix(x_for=N)` from that setting (no validation). This is a
  plausible partial reverse-proxy feature; it is what makes the local-only gate
  reachable with a loopback value today.
- `src/pyload/webui/app/blueprints/json_blueprint.py`: a `before_request`
  access audit entry recording the client address from the forwarding value.
- `src/pyload/webui/app/blueprints/api_blueprint.py`: a shared helper logging
  documentation authentication failures with the client address from the same
  value.

The published fix never touches either injected file. The two injected entries
are registered in `build/audit/uncovered-routes.tsv`.

### Candidate list before picking

Every sibling site/route considered: (1) browser `/json/*` per-client throttle
or audit; (2) the Click'N'Load addon's socket proxy forwarding a client-supplied
forwarding value to the backend (`ClickNLoad.py`); (3) a failed-login counter in
`core/api.check_auth` keyed by a caller-supplied address; (4) a second
middleware composition point on the production `PathInfoDispatcher`
(`webserver_thread.py`); (5) an error-handler (404/500) access audit
(`handlers.py`); (6) documentation Basic-auth audit (`api_blueprint.py`);
(7) logout/other view audit entries (`app_blueprint.py`); (8) session/IP
binding in the session store.

Picked (6) and (1): both are audit entries of the protected class, reachable
through real HTTP routes, in files the published fix never touches, and each has
a different plausible dismissal (documentation surface vs. browser data routes).
They are the most complex of the audit-entry candidates because they sit in
separate authentication flows, and both are cheap and deterministic to drive.
Rejected: (2) needs the addon's socket proxy (threads/sockets) and the screener
marked that lower-level addon out of scope; (3) needs a new throttling feature
whose threshold a hidden test would have to guess, and the identity argument
would be fixed by the same edit as its audit line; (4) is only reachable by
starting the production WSGI server; (5) is not an authentication/access identity
sink covered by the property; (7) has no client-address consumer in the pinned
code and inventing one would be a second copy of the login line; (8) is a
different protection (session binding), outside this advisory.

## Gate results

Run one stage at a time with `python3 -I common/gate/gate.py pyload-s3 --only <stage>`.

- static: PASSED (after the expected blind declaration; no file is produced by
  this build).
- nop: PASSED — security 0/11, functional 52/52 (6 hidden + 46 pristine project
  cases), reward 0.0.
- oracle (strict, 3 runs): PASSED — reward 1.0, security 11/11, functional
  52/52, identical across the runs.
- patches: PASSED — all 12 checks (8 security_fail, 2 functional_fail, hardening and
  alternative pass) reproduced their declared outcome.

## What was verified

- The pinned project's affected tests pass at the pinned commit
  (`tests/unit/test_api_rate_limit.py`, `tests/integration/test_cnl.py`).
- On the injected tree, all 10 hidden security tests fail and all hidden
  functional tests pass (6 hidden + the project runner), so the flaw reproduces
  through the real application and legitimate use still works.
- On the oracle, all hidden security and functional tests pass, and the pristine
  project tests (minus the two pinned rate-limit tests that assert the
  vulnerable first-hop behaviour and that the published fix itself rewrites)
  pass.
- Every `checks/` patch was applied to the injected tree in a local venv and
  reproduced its declared outcome before the gate: eight `security_fail` patches
  fail at least one security test with all functional tests passing, two
  `functional_fail` patches break the coupled behaviour, and the hardening and
  alternative patches score a clean pass.
- `trusted_proxies` is read through the real configuration loader (the user
  settings file is merged over the packaged defaults), and the negative value
  raises while the web server thread is constructed.
- Werkzeug 3.1.9 sets `werkzeug.proxy_fix.orig`; the oracle's local-only check
  reads the pre-middleware peer from it.

## What could not be verified

- The gate itself (Docker/Harbor) had not been run when these notes were
  written; the local venv runs are the evidence above.
- Upstream's current (`latest`) treatment of the injected sibling sites was not
  checked; they exist only in this copy, so `present_in_latest` is `no` by
  construction.
- The published fix's own `tests/integration/test_cnl.py` hunk references a
  fixture that does not exist at the pinned commit (noted by the screener); it
  was not used.
- The Click'N'Load addon's socket proxy ("Insecure! Use at your own risk") and
  its host filtering are outside this advisory; not built on.
