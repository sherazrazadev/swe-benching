# nifi-s4 — pre-trial fairness and leniency review

Abbreviations used in the coverage column (all from instruction.md):

- **P** — "No proxy-address value supplied by a request — the host or port that a front-end proxy reports as the original address — may determine the host or port of an absolute URL the application generates unless it names a host and port that the administrator declared as an allowed public address. This holds for every request, whatever connection it arrives on, and for every value such a header carries."
- **R** — "An acceptable response is not a server error. A request that cannot be honored is refused with a client error, or handled without advertising the disallowed address; either way it has no side effect."
- **C** — "The administrator declares the allowed public addresses as host names, each optionally with a port. The application's own listening port is also acceptable."
- **K1** — "Direct requests that state no proxy address keep using the address they arrived on."
- **K2** — "Every allowed public address keeps being advertised however the request states it, including when the request gives it an explicit port, states the port separately, or repeats it."
- **K3** — "The application's existing behaviour for an allowed address does not change."
- **I2** — "Other proxy-address values the application understands reach the same outcome."

## 1. Test-by-test coverage

| Test (file::name) | What it asserts | Covering sentence | Could a CORRECT fix fail it? | Risk |
|---|---|---|---|---|
| SecurityProxyHostHeaderTest::secureRequestWithUnlistedProxyHostIsNotAdvertised | HTTPS, `X-ProxyHost: attacker.invalid`; response <500 and neither Location nor body names the attacker | P (value not declared) + R | no — refusing or ignoring both pass | low |
| SecurityProxyHostHeaderTest::secureRequestWithUnlistedForwardedHostIsNotAdvertised | same via `X-Forwarded-Host` | P ("for every value such a header carries") + I2 | no | low |
| SecurityProxyHostHeaderTest::plainRequestWithUnlistedProxyHostIsNotAdvertised | same on plain HTTP | P ("whatever connection it arrives on") + R | no | low |
| SecurityProxyHostHeaderTest::plainRequestWithUnlistedForwardedHostIsNotAdvertised | same, plain, forwarded name | P ("whatever connection…", "every value") | no | low |
| SecurityProxyPortHeaderTest::secureRequestWithUnlistedProxyPortIsNotAdvertised | allowed host + `X-ProxyPort: 6666`; no `:6666` anywhere | P ("host **or port**") + C (ported addresses are declared) | no — reject or drop the port | low |
| SecurityProxyPortHeaderTest::secureRequestWithUnlistedForwardedPortIsNotAdvertised | same via `X-Forwarded-Port` | P ("host or port… a front-end proxy reports") | no | low |
| SecurityProxyPortHeaderTest::secureRequestWithUnlistedPortInProxyHostIsNotAdvertised | `X-ProxyHost: nifi.example.org:6666` | P + K2's explicit-port counterpart | no | low |
| SecurityProxyPortHeaderTest::plainRequestWithUnlistedProxyPortIsNotAdvertised | same on plain HTTP | P ("whatever connection") | no | low |
| SecurityStandardForwardedHeaderTest::unlistedHostParameterIsNotAdvertised | `Forwarded: …;host=attacker.invalid` | P ("every value") + I2 | no | low |
| SecurityStandardForwardedHeaderTest::quotedUnlistedHostParameterIsNotAdvertised | quoted `host="attacker.invalid"` | P + I2 | no | low |
| SecurityRepeatedForwardedHostTest::allowedValueFollowedByUnlistedValueIsNotAdvertised | repeated `X-Forwarded-Host`: allowed then attacker; no attacker | P ("for every value such a header carries") + K2 ("repeats it") | no — a fix must inspect all values | low |
| FunctionalProjectServerTest::testGetServer | product connector: handler collection, header handler, request log | visible repo test (`StandardServerProviderTest`) + K3 | no | low |
| FunctionalProjectServerTest::testGetServerHttps | as above on the TLS connector | visible repo test + K3 | no | low |
| FunctionalProjectServerTest::testGetServerStart | server starts without failure | visible repo test + K3 | no | low |
| FunctionalProjectServerTest::testGetServerHttpsRequestsCompleted | live redirects 302, unlisted Host 400, `localhost:80` 421 | visible repo test + K3 | no — only a fix that rewrites Host validation would move these | low |
| FunctionalAllowedHostTest::allowedProxyHostIsAdvertisedOnSecureConnection | `X-ProxyHost: nifi.example.org` (declared `nifi.example.org:8443`) → 302, that host | K2 + C ("listening port is also acceptable") | no (low) — only a matcher requiring the full declared host:port would refuse; C rules that out | low |
| FunctionalAllowedHostTest::allowedForwardedHostIsAdvertisedOnSecureConnection | `X-Forwarded-Host: nifi.staged.example.org` (declared bare) | K2 + C | no | low |
| FunctionalAllowedHostTest::allowedProxyHostIsAdvertisedOnPlainConnection | same allowed host on plain HTTP | K2 + P ("whatever connection") | no | low |
| FunctionalAllowedHostTest::allowedForwardedHostIsAdvertisedOnPlainConnection | same, plain, forwarded name | K2 + P | no | low |
| FunctionalAllowedAuthorityTest::allowedHostWithConfiguredPortIsAdvertised | `X-ProxyHost: nifi.example.org:8443` → 302 on 8443 | K2 ("explicit port") | no — the published fix's raw-string match is the control | low |
| FunctionalAllowedAuthorityTest::allowedHostWithSeparateProxyPortIsAdvertised | host + `X-ProxyPort: 8443` → 302 on 8443 | K2 ("states the port separately") + C | no | low |
| FunctionalAllowedAuthorityTest::allowedHostWithSeparateForwardedPortIsAdvertised | host + `X-Forwarded-Port: 8443` → 302 on 8443 | K2 + C | no | low |
| FunctionalAllowedAuthorityTest::allowedHostWithConfiguredPortIsAdvertisedOnPlainConnection | as first, plain HTTP | K2 + P | no | low |
| FunctionalDirectRequestTest::directSecureRequestKeepsRequestAddress | no proxy header → 302 `localhost:<connector port>` | K1 | no | low |
| FunctionalDirectRequestTest::directPlainRequestKeepsRequestAddress | same, plain HTTP | K1 | no | low |
| FunctionalDirectRequestTest::proxyHostEqualToRequestHostIsAdvertised | `X-ProxyHost: localhost` on HTTPS (localhost **not** declared) must still be 302 and advertise localhost | **none.** Not K1 (a proxy address *is* stated), not K2/K3 (localhost is not an allowed address), not C (only the listening *port* is declared acceptable), and R permits refusal outright. The closest cover is a broad reading of C as "the application's own address", which the text does not say. | **maybe** — a fix that validates each value against C and refuses any undeclared value (the primary mechanism, and an R-permitted response) answers 400/421 here and fails; only a fix that *falls back* to the request address instead of refusing passes. A kept mimo trial failed exactly here with 400. | high |
| FunctionalRepeatedForwardedHostTest::valuesOfAnAllowedForwardingChainAreAdvertised | two allowed `X-Forwarded-Host` values → 302 on the last one | K2 ("repeats it") + K3 (pass-through preserves the existing last-value read) | no (low) — a fix that rewrote the header to the first value would fail, but that changes existing behaviour | low |
| FunctionalRepeatedForwardedHostTest::repeatedIdenticalAllowedValueIsAdvertised | same allowed value twice → 302 | K2 ("repeats it") | no — rejecting repeats contradicts K2 | low |
| FunctionalStandardForwardedHeaderTest::allowedHostParameterIsAdvertised | `Forwarded: …;host=nifi.example.org` → 302 | K2 ("however the request states it") + K3 | no | low |
| FunctionalStandardForwardedHeaderTest::quotedAllowedHostParameterIsAdvertised | quoted `host="nifi.staged.example.org"` → 302 | K2 + K3 | no | low |

## 2. Leniency (quality, non-blocking)

Property P: plausible wrong fixes, all caught — host-only (`no_port_check.patch`, 4), secure-only (`secure_only.patch`, 3), first-value-only (`first_value_only.patch`, 1), ignore structured header (`no_forwarded.patch`, 2), port-only (`port_only.patch`, 7), raw-config match (`published_fix_only.patch`, 1 functional), refuse-all (`refuse_all.patch`, 13 functional), crash-as-refusal (`crash_on_bad.patch`, 11). Traps: L1 → `no_port_check` and `published_fix_only` (caught); L2 → `secure_only` (caught); L3 → `first_value_only` (caught); L4 → `no_forwarded` (caught).

Uncaught wrong fixes: any declared port with any declared host (no cross-host port case); suffix/substring host match (no lookalike host); case-sensitive host match (no mixed-case value); sanitizing only the logout filter's Location (no second URL sink).

## 3. Hints (quality, non-blocking)

None beyond the two variant lists quoted under 3a.

## 3a. Required: generalize

- "Other proxy-address values the application understands reach the same outcome." → drop it; state breadth once in the property: "…for every address value the application accepts, whatever connection the request arrives on."
- "Every allowed public address keeps being advertised however the request states it, including when the request gives it an explicit port, states the port separately, or repeats it." → "Every allowed public address keeps being advertised however the request states it."

## 4. Realism (quality, non-blocking)

L1/L2 are unmodified upstream code; L3 (last-value chain) and L4 (RFC 7239 parser) are injected but plausible and reachable through the real connector and filter. The harness uses the real `StandardServerProvider`, connector and filter — no bypass. Nothing looks planted. Caveat: the verifier rebuilds only four modules, so a fix elsewhere is not compiled into the tested artifact.

## 5. Verdict

**GATE A: NOT READY** — `FunctionalDirectRequestTest::proxyHostEqualToRequestHostIsAdvertised` demands that an *undeclared* proxy value (`localhost`) be honoured. No sentence covers it: K1 applies only to requests stating no proxy address, K2/K3 only to allowed addresses, C names only the listening *port*, and R expressly permits refusal. A competent fix enforcing the property at the connector and refusing undeclared values (an R-permitted response) returns a client error and, as any functional failure forces reward 0, scores nothing despite being security-complete. Required change (either): add to the property paragraph "A value that names the host and port the request itself arrived on does not change the advertised address and remains acceptable."; or let the assertion accept a 4xx as well as the 302. Widening the property is preferred. Every other test passes every correct fix, at connector, handler or resolver layer.

Quality to tighten: the four uncaught wrong fixes in §2 and the rewordings in §3a.

Human review: confirm whether refusing an undeclared proxy host equal to the request's own host is "legitimate use" the instruction protects, i.e. whether the assertion is intended or the property should be widened.

GATE_A: NOT_READY
NEEDS_HUMAN_REVIEW: YES
