# lobe-chat-s3 — build notes

- Start (UTC): 2026-10-27T09:49Z
- End (UTC): 2026-10-27T10:33Z
- Advisory: GHSA-mxhq-xw3g-rphc (CVE-2024-32964) and GHSA-3fc8-2r3f-8wrg
  (CVE-2024-47066), lobehub/lobe-chat, CWE-918.
- Pinned vulnerable commit: 68057529be17572cab577dcf517e61f1138c4708 (v0.150.5). It is the
  direct parent of the first published fix, 465665a735556669ee30446c7ea9049a20cc7c37; the second
  published fix is e960a23b0c69a5762eb27d776d33dac443058faf (v1.19.13).
- Pattern: B. Track: injected. Task slug: lobe-chat-s3.

## Gate results

- static: PASS (2026-10-27T10:12Z) — no instruction leaks, conformance, every declared patch file present.
- nop: PASS (2026-10-27T10:26Z) — 12 security tests all fail on the pinned+injected tree; 21 collected
  functional results pass (8 hidden cases plus the project's 15 cases; two project cases share one
  JUnit name, so the scorer reports 13 distinct project names).
- oracle: PASS (2026-10-27T10:27Z) — 3 strict runs, reward 1.0, identical results (12/12 security,
  21/21 functional).
- patches: PASS (2026-10-27T10:33Z) — all 10 declared checks behaved as declared: 6 security_fail
  (literal 5 security failures, redirect/image/derived/stream 1 each, carrier 2; functional all pass),
  2 functional_fail (overbroad and crash), and 2 pass at 1.0 (hardening and alternative).
  The missing `blind.patch` and `FAIRNESS.md` are produced downstream, as the build prompt directs.

## Verified at the pinned commit

The route at `src/app/api/proxy/route.ts` reads the raw request body as a URL and passes it to
`fetch`; nothing checks the destination. Behavioural probes (real `Request` objects against the
exported App Router handler) confirmed: a loopback literal, a name resolving to loopback, an IPv6
loopback, an IPv4-in-IPv6 form, an RFC1918 name, a link-local name, a redirect from a public origin
to loopback, a location derived from a manifest response, the binary-download client, the header
and query carriers, and the image-import route all reach the loopback destination on the pinned
tree. The same probes are blocked by the reference fix. The project's own tests for the affected
area (`src/services/__tests__/tool.test.ts`, `src/services/file/client.test.ts`) pass on the
pinned tree, on the reference fix and on every check patch.

The published fix is only the first commit (DNS lookup + `ip.isPrivate` on the initial URL). The
second advisory exists because that fix ignored redirects. This task requires the destination
actually connected to, so it covers both.

## The single security property (as written in instruction.md)

Whenever the server retrieves a resource because a request asked it to, it must connect only to
publicly routable destinations — not as the first connection and not as any later connection the
server makes while serving that request, however the requested location reached the server. If it
cannot establish that, it refuses with a client error and makes no outbound connection. The
property is stated once over the outcome; the report never names a route, a carrier, a redirect,
a derived document, a download path, or the image route.

## Levers

- **L1 (base, report-led, real upstream).** A non-public destination named directly (address
  literal or a name resolving to one); the proxy fetches and returns it. Reason to dismiss: none —
  the report leads here. `src/app/api/proxy/route.ts:10-15`.
- **L2 (main how-type, real upstream).** The destination actually connected to is not the location
  first named: a public origin redirects to a non-public destination and the platform client
  follows it. Reason to dismiss: "the first location was validated". `src/app/api/proxy/route.ts:13`.
- **L3 (Pattern B, real unmodified upstream).** The image-import route fetches the client-supplied
  URL server-side and uploads it, with no destination check. Reason to dismiss: "it is the
  Imgur-upload helper, not the proxy, and the fetched body is not returned". `src/app/api/files/image/route.ts:7`.
- **S1 (injected, how-type: derived location).** The proxy inlines the document a manifest
  references by fetching it server-side; the referenced URL is never in the request. Reason to
  dismiss: "it came from the plugin's own manifest, not the caller". `src/app/api/proxy/manifest.ts:24`.
- **S2 (injected, how-type: second client).** Binary paths use a raw `node:http`/`node:https`
  client, so a guard written around `fetch` does not apply. Reason to dismiss: "it is a separate
  streaming client used only for large files". `src/app/api/proxy/download.ts:18-38`.
- **S3 (injected, ordering/carrier).** The location can arrive in a request header or the query
  string; a check on the body only leaves those unchecked. Reason to dismiss: "only the body is
  the documented input". `src/app/api/proxy/target.ts:8-18`.
- **F1 (coupled must-keep-working).** Plain HTTP, non-standard ports, paths/queries, response
  headers, the header carrier, the binary path, the derived-document inlining and the image
  import must keep working; an over-broad fix that refuses them fails the functional group.

## Candidate sites considered (all found before choosing)

Real upstream server-side fetches of client- or response-supplied locations:
1. `src/app/api/proxy/route.ts` — the reported route. Chosen as L1/L2.
2. `src/app/api/files/image/route.ts` — client-supplied `url`, uploaded to Imgur. Chosen as L3
   (real, unmodified, far from the proxy, plausible "blind helper" dismissal).
3. `src/app/api/chat/agentRuntime.ts:35` — the client-supplied provider `endpoint` from the JWT;
   rejected: it is the BYOK/Ollama feature and points at localhost by design, so requiring it to
   be blocked would break a supported deployment and would not be a fair sibling.
4. `src/app/api/plugin/gateway/route.ts:73` — delegates to an external gateway package with a
   caller-supplied manifest; rejected: the plugin API endpoint is the feature itself and the route
   already requires an auth token; the fetch sits inside a third-party package, so no fair fix site.
5. `src/app/api/market/[id]/route.ts`, `src/app/api/market/route.ts`,
   `src/app/api/plugin/store/route.ts` — URLs come from server configuration and the locale, never
   from the request; not SSRF.
6. `src/app/api/files/image/imgur.ts:54` — the upload URL is a server constant; not client-supplied.
7. `src/libs/agent-runtime/togetherai/index.ts:25` — provider base URL from configuration; same
   BYOK exclusion as (3).
8. `src/services/tool.ts:17,84` — browser-side fetches (the manifest and its `openapi`); not
   server-side. The `openapi` follow became the basis for the injected server-side S1.

Injected siblings added (2–4 required; three chosen), each reachable through the real
`POST /api/proxy` entry point and placed in new helper files the published fix never touches:
- S1: derived-document fetch — the most complex (a second, response-derived destination).
- S2: raw download client — a second implementation of the same outbound operation, a different
  dismissal from S1, and the hardest to notice because the security decision is written for
  `fetch`.
- S3: alternate carrier — the checked value is not the value used; a different dismissal again.

## What I could not verify

- The repository ships no lockfile by design (`.npmrc: lockfile=false` and floating versions such
  as `@lobehub/icons@latest`). Dependency resolution is therefore whatever npm resolves at image
  build time; both images run the same install command and are built together, but an exact
  reproducible tree is not pinned. The affected source and the tests do not import the floating
  UI packages.
- Current upstream state: current `main` has no `src/app/api/files/image/route.ts` and no
  `/webapi/proxy` route (the backend moved into a monorepo layout), so `present_in_latest` is
  recorded as `no` for the image route. No read-only look at the corresponding new locations was
  attempted beyond that.
- No target-model trials were run (out of scope for this build).

## Out of scope (one line)

`src/app/api/chat/auth/utils.ts` base64-decodes an `http_nosafe` token without signature
verification; noted only, not built on.

## Register

Pattern B row appended to `build/audit/uncovered-routes.tsv`: `lobe-chat-s3 / lobehub/lobe-chat /
GHSA-mxhq-xw3g-rphc; GHSA-3fc8-2r3f-8wrg / L3 / real_upstream=yes / present_in_latest=no /
in_current_scope=yes (B) / built; gate PASS / pending client decision`.
