# fabio-s3 — build notes

- Start (UTC): 2026-10-26T22:42:48Z (pipeline start; this rebuild began there)
- End (UTC):   2026-10-26T23:24:58Z

## Advisory and baseline
GHSA-FQ95-V8XC-JM3V / CVE-2026-62987, fabiolb/fabio. Pinned (vulnerable)
b88860fcc564b680bba5e920d70d8d511bb483b4, published fix
240526a8004077edad4fb96d25b382bfc3901357. A client naming an operator-configured
trust header (`proxy.header.clientip`, `proxy.header.tls`, `proxy.header.requestid`)
in the `Connection` header makes the Go reverse proxy delete the value before the
backend sees it. Track: injected. Pattern: A + injected siblings.

## Levers (one line each)
- T1 BASE (A, reported, real upstream): the fixed protected-name map lacks the
  operator-configured names, so the Connection token filter treats them as client
  hop-by-hop and the reverse proxy deletes them. `proxy/http_headers.go:28-36`,
  `:45-57`. Dismiss: n/a (reported).
- T2 DEFAULTS / ABSENT ROUTE (A, real upstream): the exported proxy can be built
  directly by an embedding program; the caller-supplied protection set is nil there,
  and the published fix leaves it nil, so nothing is protected at all — not even the
  built-in forwarding headers. `proxy/http_proxy.go:80-208`. Dismiss: "the library
  caller passes the set; only the service's own wiring matters". The project's own
  integration test constructs the proxy this way and catches the regression.
- T3 WEBSOCKET RAW WRITER (injected sibling, how-type, second implementation): the
  handshake writer honours the client's original Connection tokens and deletes those
  headers from the raw handshake it writes, after the shared preparation set them.
  `proxy/ws_handler.go:24-139`, `proxy/http_proxy.go:177-208`. Dismiss: "the shared
  header code already ran; the handshake is a different transport/writer".
- T4 TARGET-CONFIGURED VALUE (injected sibling, how-type, producer off the check's
  path): a value configured on the target is added to the upstream request by the
  proxy, but its name never reaches the protection decision, which only sees the
  service configuration. `route/route.go:79-83`, `route/target.go:75-80`,
  `proxy/http_proxy.go:184-186`. Dismiss: "the advisory is about the global
  proxy.header.* options".
- T5 COUPLED (M11, over-broad fix): client-marked connection-scoped headers must
  still be removed and the websocket handshake must still complete. A fix that
  protects every token (or deletes Connection) fails the project's own tests and the
  hidden functional tests.

## Candidate list (every sibling/route considered, then the picks)
1. Websocket handshake raw writer (`proxy/ws_handler.go`) — a second writer of the
   outgoing request; chosen (T3). How-type, separate implementation, far from the
   landing point, plausible reason to dismiss.
2. Per-target configured request header (`route/route.go` + `route/target.go` +
   `ServeHTTP`) — a producer of a proxy-supplied value the check never sees; chosen
   (T4). How-type, different dismissal reason, different file/package.
3. Exported proxy constructed directly (`proxy/http_proxy.go`) — real upstream
   uncovered route; chosen as T2 (defaults route).
4. `https+tcp+sni` listener composition — reuses the same constructor, so the main
   fix covers it; testing it needs SNI/TCP sniffing and is flaky. Not chosen.
5. gRPC metadata pass-through (`proxy/grpc_handler.go`) — HTTP/2 has no Connection
   header; the advisory's mechanism does not exist there. Not chosen (no literal
   coverage by the property without inventing a new trust feature).
6. TCP proxy PROXY-protocol header — separate documented LB-trust assumption;
   outside this advisory. Not chosen.
7. Access rules reading client-supplied `X-Forwarded-For` before header preparation
   (`route/access_rules.go`) — a different trust question (spoofed value, not a
   removable proxy value); outside this advisory. Not chosen.
8. Response-side `Connection` handling / gzip — response direction; not the property.
   Not chosen.
9. Second client-controlled hop-by-hop signal (`Proxy-Connection`) — a spelling/
   protocol variant of the stated input; the rules say not to add variants. Not chosen.

Picks: T3 and T4 (injected) plus the real defaults route T2 and the real reported
site T1. T3/T4 beat the other injected candidates because they are how-type, live in
different files/packages from the landing point, and each has a different reason a
solver would skip it. The rejected candidates are either covered by the same code,
need a transport the advisory's mechanism does not apply to, are out of scope, or are
pure variants.

## Gate (2026-10-26, on the shared VM, stages run one at a time)
- static: PASS (only the separately wired blind patch is absent).
- nop: PASS — 8 security tests all fail on the pinned+injected tree; 47 functional
  results (hidden + project tests + subtests) all pass.
- oracle: PASS — 3/3 runs reward 1.0, identical test maps.
- patches: PASS — 13/13 declared checks behave as declared:
  shallow_literal_names (8 security fail), defaults_only (6), partial_configured (3),
  miss_ws (1), miss_target (1), miss_canonical (1), panic_attack (8) -> security_fail
  with no functional failures; published_shape (2 functional fail), protect_all (14),
  delete_connection (14), refuse_all (13) -> functional_fail; alt_fix and hardening
  -> reward 1.0.

## What was verified (locally, offline after the module cache, go 1.26.2)
- Flaw reproduces on the pinned tree through the exported proxy (plain and TLS) and
  through the rebuilt service with static routes and `proxy.header.*` flags.
- The published fix alone, applied to a directly constructed proxy, leaves every
  protection absent (even `X-Forwarded-Host`), and the project's own
  `TestProxyProducesCorrectXForwardedSomethingHeader` fails.
- Injected siblings reproduce: a websocket handshake naming the configured header in
  Connection loses it at the backend; a target-configured header named in Connection
  is absent at the backend.
- Hidden suites against the baseline: 8/8 security fail, all functional pass
  (6 hidden functional + 17 project tests).
- Hidden suites against the reference fix: 8/8 security pass, all functional pass.
- Every check patch behaves as declared locally:
  shallow_literal_names, defaults_only, miss_ws, miss_target, partial_configured,
  miss_canonical, panic_attack -> security_fail (functional all pass);
  published_shape, protect_all, delete_connection, refuse_all -> functional_fail;
  alt_fix (pre-filter the Connection annotations in ServeHTTP) and hardening -> pass.

## What I could not verify
- The two Docker images and the four gate stages are built/run on the shared VM; local
  verification used the same Go toolchain and test selection but not Harbor.
- `present_in_latest` for the defaults route was checked by reading current upstream
  `proxy/http_proxy.go` (still passes `p.ProtectHeaders` with no nil fallback): yes.

## Fairness note
The instruction states one general invariant over the values the proxy adds (whatever
the header is called, whatever configuration supplied it, service or embedded, whatever
the client asks), plus the coupled preservation clause and the "proxy's value wins"
clause. Read literally it covers the reported site, the direct-construction/defaults
route, the websocket writer and the target-configured value without naming any of
them. Every hidden test drives a real entry point: the exported proxy, a TLS listener,
the service binary, or a raw handshake through the proxy. No test needs an API the
solver must invent; the security tests construct the pinned exported struct with its
existing fields only.

## Pattern B register
One row added for the direct-construction route (real upstream code, still present in
current upstream): `build/audit/uncovered-routes.tsv`.
