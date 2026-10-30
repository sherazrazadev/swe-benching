# rust-sdk-s4 - build notes

- Start (UTC): 2026-10-30T07:37:43Z
- End (UTC): 2026-10-30T08:09:09Z
- Advisory: GHSA-33F5-2C5Q-WGWJ / CVE-2026-63127 (modelcontextprotocol/rust-sdk), CWE-345.
- Pinned vulnerable commit: eb435c6f51864df74926ef115befce55c16b01ba. Published fix: c1a8b29ff2cc45e7820b900dae42cbb4958089ec.
- Track: injected; pattern B. Injection: an origin-wide protected-resource metadata merge inside the
  fetch helper (second metadata consumer), applied to our copy only (environment/injection.patch).

## Levers (one line each)

- T1 (how-type, shape + coupled): resource-identifier equivalence must allow an origin-only
  trailing-slash difference and reject path differences; crates/rmcp/src/transport/auth.rs:1840/:1895.
  Dismissed as "trailing slash is cosmetic, normalise it", or implemented as plain equality.
- T2 (real Pattern B route, where protection never existed): the client-credentials token request
  forwards a caller-supplied resource identifier instead of the server address;
  crates/rmcp/src/transport/auth.rs:2322. Dismissed as "a separate flow; the caller chooses the audience".
- T3 (injected, second metadata consumer): the fetch helper folds authorization servers from the
  origin-wide canonical protected-resource document without checking that document's resource;
  crates/rmcp/src/transport/auth.rs:1998/:2015. Dismissed as "the requested document was validated" /
  "that is only a compatibility fallback".
- T4 (real, ordering/side effect): scopes from the protected-resource document are stored before the
  identity check, so a refused document still influences later requests;
  crates/rmcp/src/transport/auth.rs:1842. Dismissed as "discovery fails, so nothing was stored".

## Candidate siblings/routes considered

Found from the screener O8/O8b leads plus a search of the OAuth client:

1. set_metadata caller-supplied metadata (O8b) - rejected: caller-trusted escape hatch, not reachable
   through the discovery path; the task needs no sibling-only API name.
2. Authorization-server host allowlist (O8b) - rejected: SSRF/private-host protection, a different
   property from resource identity.
3. Client-credentials `resource` parameter (O8b) - PICKED as T2 (real, unmodified upstream code,
   same audience-binding property, ~460 lines from the landing point, different reason to dismiss).
4. Per-candidate-path expected resource in well_known_paths (O8b) - folded into T1's wrong-object
   fixture (path-inserted deployment with resource = server address); no separate lever.
5. Authorization-server metadata issuer binding (O8) - rejected: real uncovered route, but a separate
   RFC 8414 requirement outside this advisory's protected-resource binding; recorded, not built on.
6. Non-string `resource` JSON shape (O8) - rejected: the documented soft-parse fallback never uses the
   document, so the pinned code already ends in an error; a security test cannot fail on pinned code.
7. Document-derived scopes stored before the identity check (own search) - PICKED as T4 (real,
   ordering/side-effect, independently testable).
8. A second metadata consumer inside the fetch path (own design, injected) - PICKED as T3: the most
   complex candidate that stays reachable through the real discovery entry point and does not disturb
   the existing fixtures (the canonical-URL guard makes it request-neutral for them).
9. Scope refresh before a scope upgrade (injection idea) - rejected: it would make the existing
   `scope_upgrade_adds_offline_access_when_as_supports_it` unit test perform real network calls
   against http://localhost, breaking the project's own tests.
10. A public "bring your own metadata" API (injection idea) - rejected: not the advisory's entry
    point, and the hidden test would need an API name the solver would have to guess.
11. The private_key_jwt client-credentials branch (second implementation) - rejected: feature-gated
    and heavy to fixture; the check at exchange_client_credentials already precedes the branch.
12. Re-discovery on refresh failure (injection idea) - rejected: invasive, a complex fixture, and
    adjacent to the same fetch helper.

Why the picks beat the rest: T1 is the only how-type shape lever paired with a coupled legitimate
value; T2 is the strongest real "protection never existed" route; T3 is the hardest reachable
candidate to find because the extra document is consumed inside a helper the fix never touches;
T4 is cheap and independent, and a correct check placed anywhere before the store passes it.

## Verified

- Pinned+injected tree builds; 106 auth unit tests pass; test_client_credentials 4/4 pass.
- Hidden security suite: 8/8 fail on pinned+injected; 8/8 pass on the oracle.
- Hidden functional suite 5/5 and pristine project test_client_credentials 4/4 pass on both trees.
- Gate stages run one at a time on 2026-10-30:
  static PASS; nop PASS (security 0/8, functional 9/9); oracle PASS 3/3 identical at reward 1.0
  (8/8 security, 9/9 functional); patches PASS 9/9 as declared.
- Nine check patches were also run locally with cargo test before the gate.
- No network at test time: hidden tests use an in-process OAuthHttpClient stub; the project
  integration test binds 127.0.0.1.
- Register: one row appended to build/audit/uncovered-routes.tsv (T2, present_in_latest = yes).

## Could not verify

- Target-model trials (DeepSeek V4.1 Flash, MiMo-V2.6-Pro) were not run; they are downstream.
- The advisory text was not available offline; scope came from the supplied summary and the fix diff.
- Non-string resource shapes and AS-metadata issuer binding were deliberately not built on (see above).

## Outside scope, noted once

- The same-origin check on the WWW-Authenticate resource-metadata URL still permits same-origin but
  different-path documents; that is the condition the resource binding closes and is in scope.
- Authorization-server metadata issuer binding (RFC 8414) and non-string resource shapes are outside
  this advisory's protection and were not built on.
