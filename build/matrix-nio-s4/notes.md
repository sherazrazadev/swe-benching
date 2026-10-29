# matrix-nio-s4 (CWE-1395, GHSA-WCHH-9X6H-7F6P) build notes

Start: 2026-10-28T23:51:09Z
End:   2026-10-29T00:34:29Z (gate stages: static, nop, oracle, patches all PASSED; full
       `gate.py matrix-nio-s4` also PASSED twice, verdict pass, gate_report.json)

## What the task is

Pinned `matrix-nio` at 13e77bb8; its encryption layer is delegated to a deprecated third-party
backend. The published fix (71a1c80) migrates the wrappers, the engine, SAS and the store to the
maintained backend. The task's hidden security suite runs on the deployment the report describes
(the deprecated backend is not importable); the functional suite runs on an upgrading install that
still carries it. The reference fix is the published source change plus ports of the two injected
sibling routes and of the fallback-key publication.

## The one property (instruction.md)

"No cryptographic operation or check may depend on the deprecated engine; where it is absent every
operation/check must still run through the maintained engine and still enforce its result; a missing
engine must never disable, skip or pass anything. State saved by earlier releases keeps working;
everything that works today keeps working; messages stay exchangeable."

## Levers (one line each)

- **T1 legacy state** (how-type; coupled must-keep-working + producer/consumer). State written by
  earlier releases must load and be usable without the deprecated backend; a port that only reads
  the new format, or upgrades by round-tripping through the engine being removed, fails.
  `src/nio/crypto/sessions.py:67-210,330-362` + `src/nio/store/database.py:170-300`.
  Dismissal: "old stored state belongs to the engine being removed." security_fail:
  `sf-legacy-via-olm.patch`.
- **T2 wire shape** (how-type; shape a plausible port mishandles). The encrypted body is text on the
  JSON wire, and normal (non pre-key) messages must decrypt too, not just the first pre-key message.
  `src/nio/crypto/olm_machine.py:358-394,1495-1520`. Dismissal: "the in-memory roundtrip already
  passes." security_fail: `sf-wire-normal.patch`.
- **T3 trust-store verification** (injected sibling; second implementation + fail-open). The trust
  database's Ed25519 check must still verify and must not accept anything when the engine is missing.
  `src/nio/store/file_trustdb.py:65-92`. Dismissal: "the trust database is fingerprint bookkeeping,
  not crypto." security_fail: `sf-fail-open.patch`.
- **T4 fallback-key publication** (injected sibling; coupled must-keep-working). Key publication
  uploads a fallback key, and the new account wrapper must keep exposing it.
  `src/nio/crypto/olm_machine.py:334-372` + `src/nio/crypto/sessions.py:63-78`. Dismissal: "key
  publication is unaffected by an engine swap." This is a functional trap (the wrong fix breaks
  the functional check); no separate security_fail patch.

Different dismissal reasons, one how-type main lever plus two more how-type levers and one
where/fail-open sibling. Each is covered by the property above as written; the instruction names
none of them.

## Candidate list (all sibling/route sites found, and why the picks beat them)

Picked:
1. `src/nio/store/file_trustdb.py` signature helper (T3) - a genuine second implementation of the
   signature primitive in another package, with a plausible fail-open repair.
2. `src/nio/crypto/olm_machine.py` share_keys fallback keys (T4) - a real producer/consumer gap on a
   core public entry point; an upstream-shaped port that recalls the published change misses it.

Rejected (kept for the record):
- `src/nio/crypto/key_export.py` account/session backup: the code would call the wrapper's
  pickle/import methods, which the port already updates, so it is not a gap; a direct-engine call
  there would be contrived.
- `src/nio/store/database.py` outbound-group persistence: the maintained engine cannot import a
  deprecated-format outbound group session, so "saved state keeps working" would be unsatisfiable;
  and it is not persisted at the pinned commit.
- `src/nio/store/database.py` second store backend: all backends share `MatrixStore`'s loaders, so
  it is not a second implementation; duplicating a loader would be artificial.
- `src/nio/store/database.py` pickle-key rotation / store upgrade: a maintainer would call the
  wrapper's methods, which auto-port; direct engine use is less plausible than the trust helper.
- `src/nio/crypto/attachments.py` (pycryptodome), `device.py`, `memorystores.py`, `key_request.py`:
  no use of the deprecated engine; not routes.
- `src/nio/client/*`: orchestration that calls the `Olm` wrapper; no second implementation.
- On-disk pickle write-back on load (the published fix's store hunk): rejected as a lever - a
  correct fix need not rewrite stored bytes, and a test on the stored bytes would hard-code the
  pickle-key derivation and reject valid designs.
- SAS old MAC method: the published fix drops it; requiring it would contradict the fix.
- Docker/contrib packaging routes (screener O8): outside library source, not reachable from tests;
  noted only (see scope).
- Pattern B (real, unmodified uncovered routes): none found. `grep` of `src/nio` at the pinned
  commit shows the deprecated engine is imported only by the three modules the published fix
  rewrites; there is no second real path to the sink. No register rows were added.

## Verified

- Flaw reproduces through the real entry point: on the injected pinned tree with the deprecated
  backend absent, `import nio.crypto` reports `ENCRYPTION_ENABLED False` and exports no encryption
  classes; 20/20 hidden security tests fail. With it present, 13/13 hidden functional tests pass.
- Reference fix: 20/20 security + 13/13 functional pass, in a local venv and inside the built image
  (`docker run` with the same PYTHONPATH split as `tests/test.sh`). The gate ran it three times
  identically (`oracle`).
- Pinned project tests pass in the environment image: `tests/sessions_test.py tests/encryption_test.py
  tests/sas_test.py tests/store_test.py tests/key_export_test.py` = 113 passed with
  `PYTHONPATH=/opt/legacy-e2e` at build time.
- Every `checks/` patch was exercised locally against both suites before the gate: `security_fail`
  patches fail only security while functional passes; `ff-remove-legacy.patch` fails functional;
  `pass-alt.patch` and `pass-hardening.patch` pass both.
- Gate: static PASSED, nop PASSED, oracle PASSED (strict, 3 runs), patches PASSED.

## Unverified / guesses

- Fix effort: the screener estimated 300 minutes; the build brief's fairness target is about 45.
  This migration is a real port (~400 added source lines); I estimate 1.5-3 hours for an engineer
  who knows where to look. Whether a model finishes or times out is unknown (no trials were run).
- Recall: the upstream migration commit is public and may be recalled. The injected siblings and
  the wire/legacy shapes are designed to survive a recalled upstream patch, but this is unverified.
- The legacy fixture databases are the published fix's own test data (synthetic `example` accounts).
  They are hidden test data only; they are not in the pinned image.
- `vodozemac==0.9.0.post2` is pinned in both images to match the fix commit's tested range; I
  verified the whole suite on it (and on 0.10.0 locally), but a solver could write against the
  installed 0.9 API only.
- The verifier's `/opt/legacy-e2e` target install is behaviourally the same as an upgrading user's
  environment for these tests; I did not test every packaging edge (e.g. pip metadata visibility).
- I did not exercise the project's full test suite (only the five affected files).

## Fairness concerns I see myself

- Size: this is a large migration; the 45-minute target is optimistic. The hidden tests are a
  subset of the migration (20 security + 13 functional), so a partial port fails, but a full
  correct port is still hours of work.
- CWE-1395 has no request-level attacker; the security suite necessarily checks the deployment
  property (the deprecated engine is absent) rather than a refused request. The tests are
  behavioural and use only public APIs, but this shape is inherent to a dependency advisory.
- The default agent image has the deprecated engine absent, so the reported impact reproduces
  immediately; the project's own pinned tests need `PYTHONPATH=/opt/legacy-e2e`, which is present
  in the image but not exported.

## Scope (one line)

CVE-2022-39255 / CVE-2024-45193 are flaws inside the third-party libolm library and the Docker and
contrib packaging routes are outside this repository's library source; none were examined or built
on.
