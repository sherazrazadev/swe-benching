# fast-jwt-s2 — build notes

- Task: `fast-jwt-s2`. Advisory: GHSA-WW5H-9M49-7XX4 / CVE-2026-107722.
- Repo: nearform/fast-jwt. Pinned (vulnerable): `86e83efd8b5244f50859532d99244f0a9a9a4368`.
  Published fix: `d96bbc6c5336055a6dbfa318fdbab01197264cfa` (`src/crypto.js` only, plus tests).
- Build started (UTC): 2026-10-28T03:41:11Z. Finished (UTC): 2026-10-28T04:08:20Z.
- Pattern A+B, track injected. Everything below was reproduced on the pinned tree with
  `node` 22 against `benchmarks/keys/*` before it was relied on.

## The mechanism in one line

The verifier decides "shared secret vs asymmetric key" by matching a PEM header at the
start of the trimmed key; any non-whitespace leading byte pushes the header off position 0,
so an RSA/EC/Ed public key is used as an HMAC secret and a token HMAC-signed with that
public text is accepted. The decision is made in three places (verify detector, sign
detector, their shared matchers) and replayed from a memo cache.

## The one general property (instruction.md)

> Key material must be used only as what it actually is: asymmetric material must never be
> used as, or accepted in place of, a shared symmetric secret, and no token may be accepted
> or produced unless its signature was created and checked with an algorithm that the
> configured material genuinely supports. This is a property of the material itself.

Every trap below is an instance of that sentence. The instruction never names a file,
function, option, route, operation, stage, format or the cache, and (from the 2026-10-28
§2 upgrade) no longer hints that material may be reused across operations: the cache lever
is covered only by the general property plus the explicit-choice contract.

## Candidate inventory (every site/route I found, then the picks)

Real code at the pinned commit (all reproduced):

| id | site / route | status |
|---|---|---|
| R1 | `performDetectPublicKeyAlgorithms` (src/crypto.js:133-170) returns `hsAlgorithms` for a prefixed public key; sync `createVerifier({key})` accepts a forged HS token | **BASE — built** |
| R2 | same detector through the async key fetcher (src/verifier.js:456) | closed by the same published fix; covered as an entry point of T1 |
| R3 | same detector with a mixed `algorithms` allowlist (`['HS256','RS256']`) | closed by the same fix; covered as an entry point of T1 |
| R4 | `performDetectPrivateKeyAlgorithm` (src/crypto.js:74-131): prefixed private key classified HS256 (signs HMAC with private material); prefixed public key used as a secret instead of refused; sync src/signer.js:233 and async src/signer.js:152 | **T2 — published fix's far site — built** |
| R5 | private-key memo read before the HS override (src/crypto.js:187-202 + 77-80): an explicit-HS signer caches `HS256` for a key and a later algorithm-less signer reuses it | **T3 — real route, published fix never touched it — built** |
| R6 | same memo caches a rejection, so a later explicit-HS use of the same string throws (documented override broken) | folded into T3 (coupled assertion) |
| R7 | public-key memo (src/crypto.js:225-240): HS-only requests return before the cache, so it cannot be poisoned | dismissed after reproduction |
| R8 | X.509 cert with a non-whitespace prefix: verifier falls into the `includes(CERTIFICATE)` branch and `createPublicKey` fails closed | dismissed (no bypass at pinned) |
| R9 | raw asymmetric JWK/JWKS JSON falls through to a secret at pinned; fixed only by the later upstream #636 (GHSA-g3jj-5cmm-3hxx), not by this advisory's fix | NOT BUILT: not derivable from this report or the code, so unfair; noted only |
| R10 | private key with a prefix on the verifier | same detector as R1; covered by T1 |
| R11 | junk PEM block before a real key | same detector as R1; covered by T1 (shape) |
| R12 | Node `KeyObject`, empty key, passphrase object + HS algorithm | all rejected/fail-closed at pinned; no route |
| R13 | async verifier ignores the HS-only override (fail-closed behaviour difference) | functional inconsistency only, not security; not built |

Injected sibling candidates (considered, with the reason each was kept or dropped):

| id | injected idea | decision |
|---|---|---|
| I1 | `keyRing` option on `createVerifier`: several verification keys, a non-PEM-looking entry is forced to HMAC (so prefixed PEM strings, prefixed certs and PEM **Buffers** become secrets) | **S1 — PICKED.** Distinct heuristic, how-flavoured (a plausible local classification that bypasses the shared detector), Buffer shape, reachable through the real verifier entry point. |
| I2 | `certificateChain` option: import each certificate; if import fails, fall back to using the value as a shared secret | **S2 — PICKED.** Different mechanism (fail-open fallback, M9), different input class (certificate), different dismissal. |
| I3 | `keyRing` entries selected per token by `kid` | dropped: one more route of I1's concept (the report's never-add rule). |
| I4 | prepared-key memo on the verifier side | dropped: same cache concept as real route T3. |
| I5 | signing-side rotation ring | dropped: role variant of I1. |
| I6 | verify with the key from the token's own `x5c`/`jwk` header | dropped: attacker-supplied key, obvious and not this advisory's mechanism. |
| I7 | key loaded from a file path | dropped: adds filesystem to a pure in-memory library; implausible. |
| I8 | JWK object support | dropped: classification by `kty` would be correct, no realistic gap, large feature. |

I1 beat I3/I5 because it is a distinct decision (not another entry to the same one) and adds the
Buffer shape; I2 beat I4/I7 because it is a different mechanism (fail-open) rather than another
cache/I-O route.

## Levers as built

| trap | pattern / kind | shape | where | reason a solver skips it |
|---|---|---|---|---|
| T1_base | BASE (report, real) | RSA/EC/Ed public keys and their Buffer forms with a comment, `//`, `.`, HTTP-header, NUL/SOH/ESC/DEL, zero-width or U+180E prefix; junk PEM block before a real key; private key with a prefix; async and mixed-algorithm entry points | src/crypto.js:133-170 | the report's own value |
| T2_far | A — published-fix far site (real) | prefixed private key auto-detects HS instead of its real algorithm; prefixed public key/cert is used as a signing secret instead of being refused; sync and async signer | src/crypto.js:74-131; src/signer.js:152,233 | "signing uses the application's own key, not attacker-supplied tokens; the report is about verification" |
| T3_cache | B — real uncovered route; how (producer off the check's path) | explicit-HS signer caches `HS256` for a key; the next algorithm-less signer with the same string signs HMAC with asymmetric material instead of refusing; the same memo also blocks the documented override after a rejection | src/crypto.js:187-202 with 77-80 | "the cached verdict came from a legitimate explicit-HS signer; the memo is a performance wrapper, not the trust decision" — the published fix left the wrapper untouched and current upstream still has it |
| T4_coupled | coupled (M11) | PEM-shaped string + explicit HS stays a raw secret; ordinary secrets, plain PEM keys, certs, async keys and prefixed (comment/header) keys that are genuine still work | src/crypto.js:77-80, 220-222; tests | over-broad fix breaks it (MiMo over-hardening) |
| S1_keyRing | injected sibling; how (local classification bypasses the shared detector) | `keyRing` entries that are prefixed PEM strings, prefixed certs or PEM Buffers are forced to HMAC and used as secrets | src/keyring.js (new); src/verifier.js option branch | "a new optional rotation convenience outside the reported single-key option; per-entry handling reads as glue" |
| S2_certChain | injected sibling; missing-authority fallback (M9) | `certificateChain` entry that cannot be imported as a certificate is used as an HMAC secret | src/certchain.js (new); src/verifier.js option branch | "certificates are public material; the fallback is an operational migration detail" |

Coupled functional requirements next to each lever: T1/T4 — explicit-HS override, plain secrets,
plain PEM keys, certificate verification, prefixed keys that are genuine; T2 — plain private keys
auto-detect, explicit algorithms, passphrase keys, async keys; T3 — explicit-HS PEM-shaped secret
works repeatedly and after a rejected detection; S1 — rotation over plain public keys and plain
secrets; S2 — a clean certificate chain verifies RS/PS tokens.

## Verification done before building

- Flaw reproduced through the real public API on the pinned tree for every prefix shape and for
  RSA, EC and Ed25519 public keys; forged HS256 tokens were accepted.
- Private key with a comment prefix: the pinned signer emits an HS256 token; the same tree's
  verifier rejects a legitimate RS256 token under a comment-prefixed public key.
- Cache replay reproduced in a fresh process: explicit-HS signer then algorithm-less signer emits
  HS256 for a public key. Reproduced again at the published fix commit, and current upstream
  (`origin/master`, 2026) still has the wrapper unchanged → the route survives both.
- Explicit-HS override with PEM-shaped strings works at pinned and at the fix commit (must be
  preserved).
- All 303 project tests pass at pinned (`node --test test/*.spec.js`, ~1.5 s).
- Certificates with a prefix already fail closed at pinned (not used).

## What I could not verify / guesses

- `repo_mb` not measured; the tree is a few hundred KB.
- The screener's `mnemonist` LRU value-equality assumption: string keys are compared by value in
  the version installed; behaviour reproduced, so no longer a guess.
- `present_in_latest` for T3: checked read-only against `origin/master` (commit `16a9691`); the
  wrapper is unchanged → yes.
- The raw-JWK route (R9) is real but belongs to a later advisory and is not findable from this
  report/code; deliberately not built.

## Deviations from the generic build prompt (the gate's conformance rules win)

- The prompt's Environment section says `/app` and `solution/solve.sh` applies to `/app`; the
  current delivery format (`common/builder/conformance_check.py`, schema 1.4) requires
  `/workspace`, a separate verifier container and no agent-kill block in `test.sh`. This task uses
  the current template: `/workspace`, `environment_mode = "separate"`, `network_mode =
  "no-network"`, no kill block.
- `tests/Dockerfile` is required by the gate and is present.

## Pattern B register

One row for T3 (real, unmodified upstream route) is appended to
`build/audit/uncovered-routes.tsv`. R9 is not built and therefore not registered.

## Result

Gate, run stage by stage with `python3 -I common/gate/gate.py fast-jwt-s2 --only <stage>`:

| stage | result |
|---|---|
| static | PASS (no warnings; only the `blind` patch file and `FAIRNESS.md` are still to be written by the later steps) |
| nop | PASS: 31 security tests fail on the pinned+injected tree; 18 hidden functional and 259 project cases pass |
| oracle | PASS: 3 runs, reward 1.0, identical results |
| patches | PASS: miss_base (19 security fail, 0 functional), miss_sign (7/0), miss_cache (3/0), miss_keyring (4/0), miss_certchain (2/0), refuse_all (125 functional fail), overbroad (5 functional fail), hardening 1.0, alt_fix 1.0 |

Test counts: 31 security tests in 5 files; 18 hidden functional tests in 5 files; the three restored
project specs contribute 259 native cases. Instruction: 406 words, no leak term, no advisory id, no
fix file name; `conformance_check.py` reports conforming.

Files delivered: `tasks/fast-jwt-s2/{instruction.md,task.toml,environment/{Dockerfile,inject.patch},
solution/{solve.sh,fix.patch},tests/{Dockerfile,test.sh,score.py,helpers.js,keys/,security/,
functional/,project/,deps/}}` and `build/fast-jwt-s2/{manifest.json,notes.md,checks/*.patch}`.

Register: one row appended to `build/audit/uncovered-routes.tsv` for T3_cache (real upstream route,
present in current upstream, built).

The raw-JWK route (R9) is a real same-family gap at the pinned commit but belongs to a later upstream
advisory and is not derivable from this report or the code; it is not built, not tested, and not
registered as in scope.

## Fairness concerns I see myself

- The two injected options (`keyRing`, `certificateChain`) are not named in instruction.md; they are
  documented in the repository, so a solver who reviews key handling can find them, but they are the
  weakest-fairness part of the task. Per the sibling-injection evidence, planted siblings rarely bite
  anyway; the cache route and the signer far site are expected to carry the task.
- The cache lever needs the solver to notice that the detection memo outlives one operation. The
  instruction does not point at the memo (the §2 upgrade removed that hint); the general property
  and the explicit-choice contract cover it literally, and the memo sits directly beside the
  detector in a small file, so it is findable by reviewing the decision path.
- The `certificateChain` fallback treats a malformed certificate as a secret. A reviewer could call
  this a caller error rather than a security flaw; the instruction's property over the material
  covers it, and the genuine material is public, so the forgery is real.
