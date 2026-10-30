# snowflake-connector-python-s4 — build notes

- Start (UTC): 2026-10-30T07:50:38Z
- Task: inject the same class of missing TLS server-identity verification into sibling
  connection paths of `snowflakedb/snowflake-connector-python`, pinned at
  2b1bf9e516950ce6afb54b82dd2b8c3f5c306fc4 (direct parent of the published fix
  8969d6dc027092ee868965db022478b6c0fa40a1).
- Pattern: A (published-fix far sites) + injected siblings. Track: injected.

## One-line mechanisms (detail lives only in the hidden tests)

- Landing: the connector's TLS wrapper swaps the caller's stdlib context for its own and never
  compares the peer certificate with the requested server name.
- Hardening: the swap also discards the caller's protocol floor / verification strictness /
  options, and the replacement context forces certificate verification on.
- Verification opt-out: a caller that turned verification off is not honoured because the
  replacement context always requires it; the post-handshake decision therefore sees the wrong
  value.
- Injected sibling: a tool helper checks only a substring of the certificate common name
  (ignores subjectAltName) before printing certificate data.
- Address forms: an address-literal name with brackets/zone is treated as a DNS name by a naive
  matcher and would be rejected.

## Security property (written once, general)

P1. Every TLS connection the connector opens on a caller's behalf must verify that the peer
    certificate names the server the connection was requested for; a certificate that does not
    cover that name, or a connection whose peer identity cannot be established, must be refused
    with a client error and no request sent.
P2. TLS settings a caller supplies (minimum protocol version, verification strictness, and
    whether certificate verification is enabled) must be preserved when the connector prepares
    its own TLS configuration; a caller who asked for something stronger must never end up with
    something weaker.
P3. A caller that explicitly disables certificate verification keeps connecting exactly as it
    does today, including with no server name available.

Both routes and the injected sibling fall under P1 literally ("every TLS connection the
connector opens"). P2 covers the published far site. P3 covers the coupled must-keep-working
value and the producer off the check's path.

## Candidate sibling/route list (every candidate found)

| # | Where | Candidate | Testable offline at uid 1000? | Verdict |
|---|-------|-----------|-------------------------------|---------|
| 1 | `tool/probe_connection.py` + `ssl_wrap_socket._openssl_connect` | raw pyOpenSSL TLS stack used by the diagnostic/probe tools; no identity check | yes (arbitrary port, loopback) | **PICKED** (inject a CN-substring check in the tool; oracle fixes the shared helper) |
| 2 | `connection_diagnostic.py:241-247` | second stdlib wrap for cert inspection | no — TLS branch is hard-coded to port 443, cannot bind as agent; and it pins certifi, so a test CA cannot be trusted without touching product data | rejected |
| 3 | `vendored/urllib3/contrib/pyopenssl.PyOpenSSLContext.wrap_socket` | honour `check_hostname` in the low-level primitive | no — every caller already goes through the wrapper's post-handshake check, so no behavioural test can isolate it through the real entry point | rejected |
| 4 | `ocsp_snowflake.py` cache/responder fetch | OCSP responder HTTPS | no — goes through `SessionManager`/vendored urllib3, i.e. already the same wrapper; needs a real responder | rejected (covered) |
| 5 | `auth/_oauth_base.py` | IdP token HTTPS | no — vendored `PoolManager`, same wrapper; needs an IdP flow/network | rejected (covered) |
| 6 | `vendored/urllib3/util/ssltransport.py` (TLS-in-TLS) | nested TLS | no — `PyOpenSSLContext` has no `wrap_bio`, TLS-in-TLS raises ProxySchemeUnsupported; needs a TLS proxy | rejected (unsupported) |
| 7 | `connection_diagnostic.py:582-600` | `verify=False` transparent-proxy probe | no (DNS to `.invalid`); used as the coupled must-keep-working value, not a sibling | used as coupling (P3) |
| 8 | `_ensure_partial_chain_on_context` | CA-bundle producer | yes, but it is trust anchors, not peer identity; outside CWE-297 | rejected (out of scope) |
| 9 | `ssl_.create_urllib3_context` (`IS_PYOPENSSL` branch) | producer of `check_hostname` | not a separate route; it is the mechanism behind the landing gap | not a sibling |
| 10 | `ssl_wrap_socket._build_context_with_partial_chain` | context factory producer | yes | **PICKED as a producer/ordering lever** (published far site; P2/P3) |

Picks: #1 (injected sibling; different module/package, plausible reason to dismiss: the probe is
a diagnostic helper and it already appears to check the name) and #10 (published far site,
producer off the check's path: the check reads the substituted context's verify mode, which the
factory overwrote). Candidates #2/#3/#6 were the other "second implementation" shapes but no
fair offline behavioural test exists for them at uid 1000; #4/#5 are already covered by the same
wrapper; #8 is unrelated to identity.

## Levers and traps

- T1 landing (pattern A, published): post-handshake identity check in the TLS wrapper.
  Dismiss reason: none (this is the reported symptom). Coupled functional: matching names.
- T2 far site / hardening (pattern A, published, HOW): context replacement drops the caller's
  minimum version / verification strictness / options. Dismiss reason: "the report is about
  hostnames; the new context already requires certificates, so it is not weaker". Coupled
  functional: a TLS 1.2 floor still connects.
- T3 producer off the check's path + ordering + coupled must-keep-working (HOW): the check reads
  the replacement context's verify mode, but the factory has already forced CERT_REQUIRED; the
  fix needs the factory to carry the caller's opt-out. Dismiss reason: "no hostname means reject"
  and "read the context the check receives". Coupled functional: explicit verification off
  connects with a wrong name and with no name; security: required verification with no name
  refuses.
- T4 address-form preservation (functional): bracketed/scoped address literals keep working.
  Dismiss reason: a naive matcher treats them as DNS names.
- T5 injected sibling (HOW): the tool's name check only looks at a substring of the common name
  and ignores subjectAltName. Dismiss reason: it is a diagnostic probe, and it already appears
  to verify the name. Coupled functional: a covering certificate is accepted.

## Sites, routes, shapes the hidden tests cover

- Entry points: the connector's urllib3 HTTPS wrap (vendored `HTTPSConnection` after network
  import) and the public probe function used when the connection-probe parameter is on.
- Security: mismatch (no context; stdlib CERT_REQUIRED context; HTTPS connection), missing name
  under required verification, certificate whose common name merely contains the host,
  caller TLS 1.3 floor against a TLS 1.2 server, sibling helper with a name-containing
  certificate.
- Functional: matching DNS name, TLS 1.2 floor, explicit verification off (wrong name and no
  name), bracketed/zoned address literal, sibling helper with a covering certificate, and the
  project's own loopback partial-chain handshake test.
- All certificates are generated in the test at run time; every server is a loopback server on
  an ephemeral port; OCSP is disabled; nothing needs the network.

## Oracle and checks (planned)

- fix.patch = published source change (hostname match, hardening carry-forward, signed-option
  normalisation) + carry the source context's verify mode + correct SAN/IP name match in the raw
  helper + remove the injected tool-side name check.
- security_fail: `sf-no-hostname`, `sf-no-hardening`, `sf-no-sibling`.
- functional_fail: `ff-no-verify-mode` (over-broad check), `ff-refuse-all`, `ff-ipv6`,
  `ff-sibling-cn-only`.
- pass: `pass-hardening` (oracle + defensive hardening), `pass-alt` (name check implemented at a
  different layer / different comparison), `pass-blind` (produced later by the harness).
- Wrong-fix catalogue mapped per class (see manifest).

## Verified / could not verify

- Reproduced at pinned: direct wrapper and vendored HTTPS connection accept a certificate for a
  different name; caller TLS 1.3 floor is silently downgraded to 1.2; explicit CERT_NONE is
  overwritten; `probe_connection` accepts a name-containing certificate.
- Published fix alone: rejects mismatch and no-name under required verification and honours the
  floor, but rejects a stdlib CERT_NONE connection (hence the oracle extension).
- Gate: static PASS; nop PASS (6 security fail by assertion, 9 functional pass); oracle PASS
  (3 identical runs, reward 1.0, 15/15); patches PASS (10/10 declared checks).
- Locally: the reference fix passes 14 hidden tests plus the project test; every check patch was
  verified for its declared expect before the gate.
- Pattern B register: no row appended — the tested sibling is injected (pattern A + injected),
  and the one real unverified TLS helper (`_openssl_connect`, used by the dump tools) is fixed by
  the shared-helper change but is not used as a pattern-B lever because its 443-only tool callers
  cannot be driven offline.
- Could not verify: target-model behaviour (trials not run, per instructions); whether current
  upstream still has the `_openssl_connect` route (not inspected).
- End (UTC): 2026-10-30T08:10:00Z
