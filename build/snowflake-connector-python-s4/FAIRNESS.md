# FAIRNESS — snowflake-connector-python-s4

## 1. Test-by-test fairness

| Test (file::name) | Asserts | Fair because | Correct fix could fail? | Risk |
|---|---|---|---|---|
| security/test_sec_server_identity.py::test_tls_wrap_refuses_certificate_for_another_name | wrapper called directly with a mismatched DNS name raises; no app data sent | "for every TLS connection it opens on a caller's behalf … The peer certificate covers the server name the connection was requested for … must be refused" (13-17) | no — any exception accepted; guard may sit in the wrapper or the pyOpenSSL context | low |
| security/…::test_https_connection_refuses_certificate_for_another_name | same through vendored HTTPSConnection | same property; HTTPSConnection is the connector's request path (3-5, 13-17) | no | low |
| security/…::test_missing_server_name_is_refused_when_verification_required | stdlib CERT_REQUIRED context + no name raises | "or a connection whose peer identity cannot be established, must be refused" (16-17) | no — a check reading the replacement context still sees CERT_REQUIRED | low |
| security/…::test_certificate_that_does_not_cover_the_name_is_refused | CN matches, subjectAltName does not → raise | "The peer certificate covers the server name" (15) | no — SAN-aware match required by the sentence; a CN-only match is the flaw | low |
| security/test_sec_tls_settings.py::test_caller_protocol_floor_is_enforced | caller TLS 1.3 floor vs TLS 1.2 server raises | "the minimum protocol version … are preserved … A caller who asked for a stronger setting must never end up with a weaker connection" (18-21) | no — carry the floor, or leave the caller's context in use; either raises | low |
| security/test_sec_probe_identity.py::test_probe_session_refuses_certificate_for_another_name | public `probe_connection` raises on SAN mismatch; no app data | "for every TLS connection it opens on a caller's behalf" (13) — the probe opens one for its caller | no — guard in `probe_connection` or in the shared raw helper both work | medium |
| functional/test_func_identity.py::test_matching_dns_name_is_accepted_by_tls_wrap | matching DNS name returns the socket | "Connections that work today … must keep working exactly as they do today" (25-26) | no | low |
| functional/…::test_matching_dns_name_is_accepted_by_https_connection | same via HTTPSConnection | same | no | low |
| functional/…::test_bracketed_address_literal_is_accepted | `server_hostname="[::1]"`, cert IP SAN ::1 connects | "The server name may be a DNS name or an IP address, in any form the connector accepts" (25) + keep-working | no — but a raw `match_hostname` with no literal normalization rejects it; the "any form" sentence demands normalization | medium |
| functional/…::test_scoped_address_literal_is_accepted | `"::1%lo"` connects | same sentence | no — same; zone stripping is the least obvious inference | medium |
| functional/test_func_preserved.py::test_verification_off_accepts_a_different_hostname | CERT_NONE + wrong name connects | "A caller that explicitly turns certificate verification off keeps connecting exactly as it does today" (22-23) | no — requires carrying the caller's verify mode (bullet 2/3), which is stated | low |
| functional/…::test_verification_off_accepts_no_server_name | CERT_NONE + no name connects | same + "including when no server name is available" (23) | no | low |
| functional/…::test_matching_caller_protocol_floor_still_connects | TLS 1.2 floor vs TLS 1.2 server connects | bullet 2 (18-21) + keep-working (25-26) | no | low |
| functional/test_func_probe.py::test_probe_session_accepts_matching_certificate | probe returns certificates for an address-covering cert | keep-working (25-26); only name coverage is required, not chain trust | no — adding chain trust fails it, but that is not the stated property | low |
| functional/project/test_ssl_partial_chain_handshake.py::test_partial_chain_handshake_succeeds_with_intermediate_as_anchor | `_build_context_with_partial_chain(None)` + wrapper completes an intermediate-anchored handshake | keep-working (25-26) + standard expert knowledge: the repo's own visible `test/unit/` test must stay green | no, if the helper stays callable (the natural optional-parameter change does); a rename/removal with the visible test edited would fail the pristine copy | low |

## 2. Leniency (quality, non-blocking)

- **P1 / T1**: CN-only comparison → caught by S4; guard only in vendored `HTTPSConnection` → S1/S3/S4; "skip verification for IP literals in the wrapper" → **no test catches** (no wrapper security test uses an IP requested name; S6 is the probe path).
- **P2 / T2**: no carry-forward → S5 (`sf-no-hardening.patch`); hard-coded TLS 1.2 floor → S5. Carry `minimum_version` only, dropping `maximum_version` / `verify_flags` / options → **no test catches**.
- **P3 / T3**: read `verify_mode` off the replacement context → F5/F6 (`ff-no-verify-mode.patch`); refuse no-name before the opt-out → F6 (`ff-none-hostname-crash.patch`); refuse everything → `ff-refuse-all.patch`.
- **T4**: no address-literal normalization → F3 (`ff-ipv6.patch`); brackets stripped but not `%zone` → F4.
- **T5**: keep the CN-only pre-check → S6 (`sf-no-probe-identity.patch`); also demand a trusted issuer → F8 (`ff-probe-chain-required.patch`); fix only `probe_connection`'s local check and leave `_openssl_connect` unguarded for its dump-tool callers → **no test catches**.
- Accepting an empty/absent peer certificate → **no test catches** (the `pass-hardening` guard is unexercised). Catalogue `n/a` entries are genuinely n/a (no second role, resource, verb or authority).

## 3. Hints and quality to tighten

- "These examples are examples, not the full set: fix the problem and its close variants." → flaw-count/variant tip; use "Fix the problem rather than special-casing the example."
- Add tests for the three uncaught wrong fixes in §2 (IP-literal mismatch through the wrapper; `maximum_version`/`verify_flags` carry; a direct `_openssl_connect`/dump-tool call).
- "The server name may be a DNS name or an IP address, in any form the connector accepts." is a variant list but is stated over the protected data and is what makes F3/F4 fair — keep it.

## 3a. Required: generalize

1. "internally it makes HTTPS requests to the account's host and to a few related endpoints" — product-level channel list. → "internally it opens TLS connections on the caller's behalf."
2. "the minimum protocol version, the verification strictness, and whether certificate verification is enabled" — setting-by-setting checklist. → "The TLS settings the caller supplied are preserved when the connector prepares its own TLS configuration."
3. "including when no server name is available" — exists only for the T3/F6 case. → drop it; the general opt-out sentence already covers it.

## 4. Realism

T1–T4 are published upstream sites; T5's CN-only pre-check is a plausible maintainer idiom reachable through the public `probe_connection`. Nothing looks planted or contrived. (Notes call the injected check "substring"; the code is exact-CN/wildcard — wording only.)

## 5. Verdict

**Gate A (fairness): READY.** Each test follows literally from one stated property: identity on "every TLS connection it opens on a caller's behalf" (S1–S4, S6, F1–F4, F8), settings preserved (S5, F7), explicit opt-out preserved (F5, F6). No test fixes an error class (all `pytest.raises(Exception)`), and none depends on layer: wrapper, vendored `PyOpenSSLContext` (`pass-alt`) and `probe_connection` guards all pass. The only inference is address-literal normalization, covered by "in any form the connector accepts" plus "connections that work today … must keep working". Fairness is READY; hints, thin coverage (IP-literal security path, extra settings) and the project test's private-helper call are quality notes only.

Human review: confirm (a) bracketed/scoped IPv6 names are "forms the connector accepts" on the solver-visible wrapper, and (b) the diagnostic `probe_connection` counts as "a TLS connection on a caller's behalf".

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
