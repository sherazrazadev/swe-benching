# middleware-s4 build notes

- Start: 2026-10-29T12:54:26Z
- End: 2026-10-29T13:25:25Z (build and all four gate stages finished; results below)
- Gate results: static PASSED (final instruction); nop PASSED (13/13 security tests failed on the
  injected vulnerable tree, 23/23 functional passed); oracle PASSED 3/3 runs at reward 1.0 with
  identical results; patches PASSED 11/11 as declared (sf_allow_both_absent, sf_missing_x,
  sf_missing_producer, sf_missing_token, sf_throw_plain_error, sf_configured_state_only,
  sf_after_exchange, ff_refuse_all, ff_break_app_auth, pass_hardening 1.0, pass_alt_shared_helper
  1.0). The blind patch is declared but intentionally not written here; static accepts that.
- Advisory: GHSA-FM3F-CH8H-QW8Q / CVE-2026-81888 (honojs/middleware, OAuth callback state validation; CWE-352, CWE-1275)
- Pinned: 70623e3703408f55599bca46336631c1175c27c2 (parent of the fix, confirmed with `git cat-file -p`)
- Published fix: b37765f40b7bddb1d8fce39573b085222dea58c1 (7 provider middlewares; the eighth, X, left fail-open)
- Task directory: tasks/middleware-s4; repo path inside the image: /workspace (the 1.4 template and
  conformance checker require /workspace; the build prompt's older /app wording was not used).

## Security property (written once, in the report)

A request may complete a social login only when it presents a state value that the library itself
generated at login start and issued to that browser; a value the library did not generate, a
caller-chosen value, a different value or no value is not proof, and the request is refused (4xx)
before the library contacts the provider and before the application route runs.

## Levers (one line each)

1. T1 initiation boundary (main, how-type, real): the obligation binds completions, not login
   starts, and only the browser-issued value counts - github/githubAuth.ts:32-38 and the copied
   block in the other six fixed providers. Reason to skip: "require the state everywhere" or the
   minimal "reject only a mismatch" both look safe.
2. T2 X provider (pattern B, real): x/xAuth.ts:36-41 keeps the copied fail-open comparison; the
   published fix never touches this file. Reason to skip: PKCE fallback plus "not in the report".
3. T3 login-start producer (injected, how-type, producer off the check's path):
   discord/discordAuth.ts:18 takes a caller-supplied state as the value issued to the browser.
   Reason to skip: it reads as an application convenience and the callback check sees an equal pair.
4. T4 token continuation (injected, how-type, completion path with no code):
   github/githubAuth.ts:19-28,40 accepts a pre-obtained provider token; github/authFlow.ts:19,47,120-122
   already reuses a supplied token. Reason to skip: a token is not an authorization code.

## Candidate list (all sites/routes found before picking)

Real:
- R1-R7 the seven providers the published fix changes (google, facebook, github app, github oauth-app,
  discord, linkedin, msentra, twitch): the both-absent comparison.
- R8 xAuth: the same copied comparison, not touched by the published fix (picked T2).
- R9 login start carrying other query parameters, especially github where the check precedes the
  redirect branch: an over-broad fix breaks it (part of T1's coupled tests).
- R10 configured fixed state (google/msentra/twitch): legitimate value that must keep working (T1).
- R11 linkedin application-token mode: no code and no user login; an over-broad fix breaks it (T1/T-ff).
- R12 packages/oidc-auth: a second OAuth state consumer, but it requires nonce and code_verifier
  cookies even when the state cookie is absent, so a state-less callback is refused. Not exploitable,
  not used (out of scope note).
- R13 multiple/encoded state spellings: `URLSearchParams` and the cookie carry literal values the
  attacker cannot know; no bypass, not used (malformed_identity n/a).

Injected candidates considered:
- I1 github token continuation: kept (T4).
- I2 login-start caller-chosen state: kept (T3).
- I3 twitch configured-state cookie mint on the callback: rejected - Hono's getCookie reads the
  request, so a cookie set during the callback is not visible to the same request's check.
- I4 a ninth provider directory with the same block: rejected - where-type, only a directory scan,
  and it repeats one concept.
- I5 form-post callback (code+state in the body): rejected - the published fix's `!state` check
  rejects it anyway because the query state is absent, so it adds no required work.
- I6 a legacy second export of a provider: rejected - where-type and repeats one concept.
- I7 refresh-token / revoke middlewares: rejected - they do not complete a user sign-in.

Picks and why: T1 is the how-type main lever (coupled must-keep-working and source of truth);
T2 is the strongest real far site (the published fix left it, and upstream later fixed it, so it is
plainly in scope); T3 and T4 are the two injected siblings with different reasons to skip and both
survive the canonical fix because they do not go through the `auth.code` gate the published fix adds.
The where-type candidates (I4, I6) were dropped as they only cost a search and repeat a concept.

## What was verified

- Fix parentage and that the fix's added regression test is absent at the pin.
- On the injected pinned tree the hidden suite scores 13/13 security failures and 23/23 functional
  passes; on the oracle 13/13 and 23/23.
- The project's own oauth-providers suite (59 tests) passes on the injected pinned tree.
- Every checks/ patch applies to the injected tree and reproduces the expected variant; each was run
  through both hidden groups: four security_fail levers, the crash/wrong-resource/order security
  failures, two functional_fail patches and two 1.0 passes (hardening and shared-helper alternative).
- All patches were generated as `a/`..`b/` diffs against the injected tree and re-applied with `patch -p1`.
- Leak terms were checked against instruction.md (no CVE/GHSA, no file or function basenames).
- The first nop run exposed a verifier-image gap: Vite reads the nearest tsconfig, whose chain
  extends @tsconfig/strictest; the package is now installed in the verifier image (tests/Dockerfile)
  so the restored workspace's tsconfig resolves offline. The rerun passed.
- In the patches stage three checks needed one Harbor retry (transient launch flakes); the retries
  ran and all 11 checks then matched their declared expectation.

## What could not be verified

- The blind patch and the fairness review are produced by other agents after this build; they are
  not in the manifest yet.
- Actual target-model behaviour (the bar) is not measured here; no trials were run, per the brief.
- `present_in_latest` for X was resolved by a read-only look at current upstream (it now has the
  strict check and SameSite/Secure); the injected siblings do not exist upstream.
- repo_mb was not measured (not needed at this point); the image installs ~530 packages for the
  oauth-providers workspace.

## Out of scope (one line, not built on)

- packages/oidc-auth/src/index.ts:430-465 also consumes an OAuth state cookie but requires nonce and
  code_verifier cookies, so the omitted-state fail-open does not apply; packages/mcp's client-side
  state passthrough is unrelated.
