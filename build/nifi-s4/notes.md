# nifi-s4: build notes (build-v1)

Start: 2026-10-29T01:45:28Z (from `build/nifi-s4/start_utc.txt`). End: see the bottom.

Advisory: GHSA-8VM2-C32J-MVFR / CVE-2026-54665 (apache/nifi). Origin validation error /
host header injection into generated absolute URLs (CWE-346). Pinned d54864b6 (parent of fix
41625c44). Pattern B, track injected.

## Security property (written once, before routes were chosen)
No proxy-address value supplied by a request may determine the host or port of an absolute URL
the application generates unless it names a host and port the administrator has declared as an
allowed public address. This holds for every request, whatever connection it arrives on, and for
every value such a header carries (`instruction.md` states this in product terms).

## Levers (one line each)
- L1 (HOW, coupled value + shape): the generated **authority** is host **and port**; the proxy
  port headers (`StandardRequestUriProvider.getPort`, `.../StandardRequestUriProvider.java:136-148`
  at the pinned commit) are consumed with no allow-list, and a configured public address may
  itself carry a port. A check that compares the raw header string to the raw configured entry
  (the published fix) rejects a legitimate `host:port` value; a check that strips the configured
  port accepts an arbitrary port. `reason to dismiss`: the report's example is a bare host, and
  the Host header's own port already has a validator, so the proxy port reads as handled.
- L2 (HOW, route where the protection never existed): the published check runs only when the
  request is secure (`fix.diff:170-176`); a plain-HTTP deployment behind a TLS-terminating proxy
  has `request.isSecure() == false`, so arbitrary `X-ProxyHost` / `X-Forwarded-Host` still become
  the generated authority (`StandardRequestUriProvider.java:97-114`). `reason to dismiss`: the
  upstream documentation scopes the property to secure deployments, so HTTP reads as out of scope.
- L3 (HOW, shape / parser differential, injected): the shared resolver treats the **last**
  `X-Forwarded-Host` value as the most recent hop (injected into
  `StandardRequestUriProvider.getHost`/`getLastHeader`), while the Jetty-level check inspects only
  the first value (`HttpFields.get` returns the first field). One request carries an allowed value
  first and an attacker value second. `reason to dismiss`: a single-valued header is assumed and
  the check and the resolver look consistent.
- L4 (WHERE/HOW, injected second parsing implementation): the shared resolver also honors an
  RFC 7239 `Forwarded` header (`host=` parameter, injected into `StandardRequestUriProvider`); the
  Jetty-level check knows only the two NiFi-specific header names. `reason to dismiss`: the
  documented proxy headers are `X-ProxyHost`/`X-Forwarded-Host`; the generic standard header looks
  unrelated to the property and to the reported header.
- Extra tested sites (not counted as levers): the published fix's own path (HTTPS + both header
  names), the request's-own-host exemption, empty/blank proxy host values, the request's own
  public port.

## Coupled must-keep-working values (functional group)
- A proxy header that carries an allowed host with the configured public port explicitly
  (`host:port`) keeps binding; a check that exact-matches the raw configured list breaks it
  (this makes the published fix a `functional_fail` control).
- An allowed host whose port arrives in a separate proxy port header keeps binding.
- An allowed host with no port keeps using the connection port.
- A repeated forwarding header whose values are all allowed keeps binding (last value used).
- The RFC 7239 `host=` form with an allowed host keeps binding.
- Direct requests (no proxy header) and the project's own connector tests are unchanged.

## Candidate sibling sites and routes (every one found)
Real, unmodified upstream:
1. Plain-HTTP connector: `StandardRequestUriProvider` + the secure-only check (`fix.diff:170-176`).
   PICKED (L2).
2. `X-ProxyPort` / `X-Forwarded-Port`: `StandardRequestUriProvider.java:136-148`; the published
   check ignores them. PICKED (L1).
3. Host-header fallback in `StandardRequestUriProvider.getHost` (`:101`) — on plain HTTP the Host
   header is also attacker-controlled. NOT PICKED: same plain-HTTP route as L2, and validating the
   Host against the proxy allow-list would refuse ordinary direct HTTP access (fairness/side
   effect on legitimate use); it is not an advisory proxy header.
4. NiFi Registry's second URL builder: `nifi-registry/.../ApplicationResource.java:83-138`
   (`X-ProxyHost` / `X-Forwarded-Server`, no allow-list). NOT PICKED: separate product with no
   proxy-host property at all (no "allowed public address" to compare against), the advisory and
   the published fix never touch it, and building/testing the Jersey/Registry stack would add a
   second product to the task for an out-of-advisory mechanism.
5. Registry Jetty redirect rule (`nifi-registry-jetty/.../ContextPathRedirectPatternRule.java`) —
   only context paths, no host. NOT PICKED: no host source.
6. `SecurityApplicationPropertyHandler` (`nifi-bootstrap/...:301-318`) — a second parser of
   `nifi.web.proxy.host` used for certificate SANs. NOT PICKED: it never reaches URL generation;
   a divergence there is not the protected outcome.
7. Framework filters that funnel through the shared resolver (`LogoutCompleteRedirectFilter`,
   `QueryStringToFragmentFilter`) — same sink, not a second implementation. Used as the entry
   point, not counted.
Injected candidates:
8. RFC 7239 `Forwarded` `host=` source in the shared resolver. PICKED (L4): a second parser, far
   from the connector, reachable on secure requests (the published check never looks at it).
9. Last-value semantics for a repeated `X-Forwarded-Host` in the shared resolver. PICKED (L3): a
   parser differential against the Jetty check's first-value read; how-type.
10. `X-Forwarded-Server` alias (Registry spelling) in the framework resolver. REJECTED: a pure
    spelling/alias variant of a stated input; both target models catch such variants.
11. A second URL builder in a Jetty handler that reads `X-ProxyHost` directly. REJECTED: on secure
    requests the connector check neutralises it, so it collapses into the plain-HTTP route (L2);
    adds no independent reason to dismiss.
12. A `?host=`/cookie public-URL override in a redirect filter. REJECTED: a different input channel
    from the advisory's header mechanism, and it would be a second vulnerability (open redirect)
    rather than a sibling of this protection.

## Verification plan
- Pinned code reproduces through the real connector (probed): `X-ProxyHost`/`X-Forwarded-Host`
  produce a 302 whose Location authority is the attacker host; `X-ProxyPort` changes the port;
  `host:port` in the proxy header is honoured; a repeated `X-Forwarded-Host` is read as the first
  value by the pinned resolver (the last-value read is injected).
- Jetty `HttpFields.get(String)` returns the first field (decompiled), and the servlet
  `getHeaders` returns both values (probed), so L3 is a real differential.
- The project's own tests for the area pass at the pinned commit in the image.
- Nop (pinned+injected): every security test fails by assertion, every functional test passes.
- Oracle: published source changes, corrected to parse host:port, plus port validation, non-secure
  validation and validation of every value of every proxy-address source.
- Each check patch behaves as declared.

## Out of scope (one line)
- NiFi Registry (same repository, separate product) builds absolute URLs from proxy headers with
  no allow-list property; recorded as candidate 4 and not built on.

## Gate results
- static: PASSED (conformance, leak terms, wrong-fix catalogue, patch declarations).
- nop: PASSED — 11 security testcases, all failing; 19 functional testcases, all passing
  (trial nifi-s4-nop-1793240450, reward 0.0).
- oracle: PASSED — 3 identical runs, each security 11/11 and functional 19/19, reward 1.0
  (trials nifi-s4-oracle1/2/3-17932409xx).
- patches: PASSED — all ten non-blind checks behaved as declared: published_fix_only functional_fail
  (1 functional, 8 security failing), secure_only security_fail (3), no_port_check security_fail
  (4), first_value_only security_fail (1), no_forwarded security_fail (2), refuse_all
  functional_fail (13), crash_on_bad security_fail (11), port_only security_fail (7),
  hardening reward 1.0, alt_correct_fix reward 1.0. The blind patch is filtered as pending
  (written by others), as is FAIRNESS.md.

End: 2026-10-29T02:54:46Z.

## Could not verify / judgement calls
- Whether upstream intended the published fix to reject port-bearing proxy host headers; our
  oracle treats that as a defect and keeps the documented `host:port` form working.
- IPv6 literal forms are handled by the allow-list parser but are not exercised by a test (no
  broker/IPv6 assumption in the container).

## Current upstream (read-only look, 2026-10-29, apache/nifi main)
- L2 (secure-only) is still present: `ProxyHeaderValidatorCustomizer.customize` still returns the
  request unchanged when `request.isSecure()` is false. `present_in_latest = yes`.
- L1: current upstream now parses a port carried inside the proxy host header and checks it
  against valid ports, so that one shape is closed. `X-ProxyPort` / `X-Forwarded-Port` are still
  not read by the check while `StandardRequestUriProvider.getPort` still uses them for the
  generated authority port, so the separate-port route is still open. `present_in_latest = yes`
  for that route.
- The current check still uses `HttpFields.get` (first value only); the multi-value and RFC 7239
  siblings are task-local injections and do not exist upstream (`present_in_latest = no`).
