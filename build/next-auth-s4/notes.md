# next-auth-s4 — build notes

- Start (driver): 2026-10-30T00:15:01Z. Build start (this session): 2026-10-30T00:15Z.
- Pinned: `nextauthjs/next-auth` @ `a63eee12a1a20cb35209e44195b097868517b9a0`.
- Published fixes: `9f7a97fade9b1319bb9ac19fc9828d62e0a2a852` (v5 `@auth/core` checks) and
  `5bca2399a79ba8d116ca5179b4b1ebcd152e7f05` (v4 package; absent from the pinned tree). Only the
  v5 site is present at the pinned commit.
- Track: injected. Pattern: A.

## Property (written before the routes)

"A value the library stores in the browser to carry an in-progress sign-in may be honoured only
by a sign-in for the same identity provider that stored it. A value stored while signing in with
one provider must never be accepted, applied or acted on when a request is for a different
provider — whatever the value carries and whichever part of the library reads it. A stored value
that does not establish which provider stored it is treated the same way."

The property is over the stored value and the provider, not over a route, file or field. Every
security route below reads literally as an instance of it; the instruction never names a site.

## Levers (one line each)

1. **T1 (how-type, shape).** A sealed check value saved before the provider was recorded carries
   no provider; a lenient comparison would keep honouring it. `checks.ts:63-72`,
   `link-intent.ts:55-66`. Reason to dismiss: backwards compatibility ("old cookies should keep
   working"). Patch: `sf_miss_legacy.patch`.
2. **T2 (how-type, protection never existed for this route).** The passkey challenge is a fourth
   sealed check value in the same cookie map, read through the same trust decision, but it is not
   one of the three checks the report names. `checks.ts:216-257` (consumed in
   `webauthn-utils.ts:238,343`). Reason to dismiss: "that is a different provider type / not an
   OAuth check". Patch: `sf_miss_webauthn.patch`, `sf_state_only.patch`.
3. **T3 (injected second implementation).** An account-link intent is sealed by its own helper
   (the OAuth check helpers are module-private) and applied on the callback without regard to
   which provider stored it. `signin/link-intent.ts`; applied at `callback/index.ts:110-130`.
   Reason to dismiss: "an account-linking intent, not a check". Patch: `sf_miss_linkintent.patch`.
4. **T4 (how-type, coupled must-keep-working).** The redirect-proxy hop forwards a provider
   callback to the app that started the sign-in and cannot hold that app's cookies; making it
   validate the stored value breaks documented behaviour. `callback/index.ts:69-81`,
   `authorization-url.ts:56-60`, `providers/oauth.ts:286`. Patch: `ff_proxy_validation.patch`.

T1/T2/T4 are how-type; T3 is the injected extra (search cost). T1 and T2 carry the security
bar; T4 catches over-hardening (MiMo's tendency).

## Sibling candidate list (all found before choosing)

Screener O8/O8b plus my own search of the pinned tree:

1. `checks.ts` `webauthnChallenge` (real) — the same sealed cookie map and `parseCookie`. Chosen
   (T2): real, unmodified upstream, a separate consumer of the same trust decision, and the
   published shared-helper fix covers it only if the solver fixes the shared decision rather than
   the three named checks.
2. `state.decode` inner state JWT used by the redirect proxy (real) — not a gap: it is a
   deliberately shared, cross-hop value, and binding it changes documented proxy behaviour. Kept
   as the coupled functional lever (T4), not as a security lever.
3. `packages/core/src/jwt.ts:173-176` `getToken` malformed-Bearer hardening (real, in the second
   published commit) — different advisory (GHSA-xmf8-cvqr-rfgj), out of this advisory's
   protection; noted, not built on.
4. `callbackUrl` plaintext cookie (real) — not provider-scoped by design (a return path is the
   same regardless of provider); binding it would be wrong, and its impact is only same-origin
   redirect. Rejected.
5. CSRF token cookie (real) — app-wide by design, not provider-scoped. Rejected.
6. `webauthn-options` challenge minting (real) — same artifact as 1, not a separate route.
7. `handleOAuth` `state.use`/`pkce.use`/`nonce.use` call sites (real) — the reported sink; the
   published fix site, not a sibling.
8. A new per-provider check minted at sign-in (O8b #2) — only meaningful with a new consumer and
   a new security outcome; would reuse the private helpers (so a shared-helper fix covers it) or
   need its own copy (what T3 already is, with a stronger outcome). Rejected as duplicate.
9. A new consumer that reads a check cookie inline (O8b #3) — if it reads a cookie already
   validated by `parseCookie` it adds no gap; a separate artifact with its own decoder is T3 in
   another shape. Rejected as duplicate.
10. Provider identity normalisation/aliasing (producer off the check's path) — no producer
    mismatch exists: mint and read both use `parseProviders` on the same config and request path.
    Rejected: no real lever.
11. v4 legacy package `packages/next-auth/src/core/lib/oauth/checks.ts` — does not exist at the
    pinned commit (the published v4 commit is on another branch). Could not be used.

Why T3 beat the other injected candidates: it is the only one whose stored value has a real,
observable protected outcome (which account a provider is linked to) and whose mint/read pair
cannot be covered by the published shared-helper change, while still being a maintainer-style
feature (account linking already exists; the helper privacy forces a local seal/open pair).

## What was verified

- At the pinned+injected tree: 9/9 security tests fail (each through a real action), 5/5 hidden
  functional and 63/63 project tests pass.
- With the reference fix: 9/9 security, 5/5 hidden functional, 63/63 project tests pass.
- Wrong-fix matrix (each patch applied to the pinned+injected tree and run):
  - `sf_miss_legacy` 5/9 security, functional pass; `sf_miss_webauthn` 8/9, functional pass;
    `sf_miss_linkintent` 7/9, functional pass; `sf_state_only` 4/9, functional pass;
    `sf_mint_only` 0/9, functional pass; `sf_crash` 0/9 (server-error refusals), functional pass.
  - `ff_refuse_all` 0/5 functional; `ff_proxy_validation` 4/5 functional (plus the project proxy
    tests fail).
  - `pass_hardening` and `pass_alt` score 9/9 + 5/5 + 63/63.
- The tests never depend on an internal cookie name: cross-provider cases replay exactly the
  cookies the real sign-in response set, and "saved earlier" cases replace the value of the
  cookie name that same provider's sign-in used. Verified because `pass_alt` (provider-scoped
  cookie names) scores 1.0.
- The tests do not use product code to compute expected values; the legacy/session/inner-state
  tokens are sealed in the test with `jose` + `@panva/hkdf` using the documented key derivation.

## Container gate

- static: PASSED.
- nop: PASSED — 9 security tests (all failing on the pinned+injected tree), 68 functional tests
  (5 hidden + 63 project) all passing.
- oracle: PASSED — 3 runs at reward 1.0 with identical results.
- patches: PASSED — 10/10 as declared: 6 security_fail (4, 1, 2, 5, 9, 9 failing security tests;
  functional all passing), 2 functional_fail (7 and 3 functional tests failing), and
  pass_hardening / pass_alt both reward 1.0.
- The wrong-fix matrix within the container matches the local matrix above exactly.
- The verifier restores its own vitest configuration (SWC only). The project's default config
  also installs the Preact Vite preset, whose Babel helper cannot be resolved from
  `packages/core` in the offline verifier; the suites do not need it, and the project tests run
  unchanged under the SWC-only config. This was found and fixed during the nop stage.

## What could not be verified

- The blind pass patch (written downstream) and whether the instruction is sufficient for a
  blind agent are not known at build time; static passes with the blind entry declared and its
  file absent, as the build prompt allows.
- The trials with the two target models were not run here; the design's security bar rests on
  T1/T2/T3 as described, with T4 catching over-hardening.
- The blind pass patch and FAIRNESS.md are produced downstream; not written here.
- The v4 branch of the published fix could not be checked against this tree (it is absent).
- Whether the two target models miss T3 as expected is only decidable by the trials; the design
  puts the security bar on T1/T2 and the injected T3, with T4 catching over-hardening.

## Scope notes

- `getToken()` malformed-Bearer hardening is part of the second published commit but belongs to a
  different advisory (GHSA-xmf8-cvqr-rfgj). Recorded as out of scope; not built on.
- No services, network, GUI or GPU are needed at run time. The verifier is offline.
- No Pattern B register rows: this is a Pattern A + injected task and the screener reported no
  uncovered routes; the passkey consumer is real upstream code but is covered by the published
  shared-helper change, so it is not registered as an uncovered route.
