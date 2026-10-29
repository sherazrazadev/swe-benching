# hydra-s4 — build notes

- slug: `hydra-s4`
- candidate: screener-v2 entry 5510 — GHSA-RQX7-P7VV-W7HR / CVE-2026-106442
  (hydra-ecosystem/hydra, CWE-184, incomplete target denylist leading to code execution
  through config-selected callables)
- track: injected, pattern B
- started (UTC): 2026-10-29T11:28:14Z (driver start; build/hydra-s4/start_utc.txt)
- finished (UTC): 2026-10-29T11:55:33Z
- host working copies: `~/.tb-graders/cwe/work/hydra-s4/` (worktrees `pinned`, `fixed`;
  `base`/`injected`/`oracle` source trees; probes `probe.py`–`probe3.py`; local suite mirror
  `run_suite.py`; variant builder `make_variants.py`)

## Verified before designing

- Pinned commit `bd5f094a` is the parent of the published fix `f462811`; it already contains the
  earlier incomplete hardening (#3409): `DEFAULT_BLOCKLISTED_MODULES`, os-alias normalization,
  literal + resolved-name authorization, and the `_target_whitelist_` mode. The advisory is about
  what that check still misses.
- Published fix `f462811` changes only `hydra/_internal/instantiate/_instantiate2.py` (plus
  tests, news, docs). The 1.3 backport `2c82bbb` is the same hardening for the other branch and
  was not used.
- Confirmed behaviourally on the pinned tree, a target the pins already refuse (e.g. `os.remove`,
  canonical `posix.remove`) is still produced:
  - `hydra.utils.get_object` / `get_method` / `hydra._internal.utils._locate` as `_target_` with
    the refused path return the refused callable (legacy and allowlist mode);
  - `builtins.getattr` over a config-obtained module returns it;
  - `functools.partial` as `_target_` returns a partial wrapping it (both when the refused
    callable comes from a nested lookup and when it is passed as an already-resolved object);
  - `_partial_: true` on the lookup helpers returns a partial; on `builtins.getattr` (legacy) it
    returns `partial(getattr, module, name)` — still open in the published fix's legacy path;
  - `builtins.object.__getattribute__` / `builtins.type.__getattribute__` (legacy) return the
    refused attribute — still open in the published fix's legacy path;
  - direct/alias/accessor spellings (`os.remove`, `logging.os.remove`, `os.remove.__call__`) are
    already refused at the pinned commit, so they are controls only and are NOT security tests.
- The published fix does **not** pass the pinned project test suite (its policy expansion and
  message changes contradict 22 pinned tests). The reference fix therefore keeps the pinned
  policy data and messages and adds only the missing mediation (the published fix reduced to its
  enforcement mechanisms). With that reduction, the full pinned `tests/instantiate` suite (576
  tests) passes on the pinned+injected tree and under the reference fix.
- `json.JSONDecoder` with an exact `_target_whitelist_` entry must keep binding although
  `_locate` resolves it to `json.decoder.JSONDecoder` (exact-entry exemption at the pinned
  commit); a wildcard entry keeps working too.
- Environment: Python 3.12, `omegaconf==2.4.0`, `pytest==9.1.1`, `attrs`. The ANTLR grammar needs
  a JVM at build time; the parsers are generated from the bundled jar on the build host and
  shipped pre-generated (environment/grammar_gen/, plus a verifier-side archive).

## Security property (stated once, general)

No value supplied by a config may make instantiation resolve, call, return or defer a callable
that the active target policy refuses — on the default policy and when an allowlist is supplied,
and for every shape of value the library accepts.

Contracts: refusal is an ordinary exception with no side effect (or a deferred value that refuses
when used); allowed targets, data values and non-refused callables keep working; exact allowlist
entries keep binding re-exported targets, wildcards keep matching, and an allowlist never launders
a refused callable; the explicit opt-out keeps working.

## Levers

1. **T1_attribute_access_primitive (how-type: route where the protection never existed).**
   `builtins.object.__getattribute__` / `builtins.type.__getattribute__` return a config-named
   attribute, so a config obtains a refused callable. The pinned policy authorizes only the target
   name, never the produced value; the published fix also leaves the default policy open and only
   refuses these under an allowlist. Dismissal: the primitive is not on the shipped list, and
   `getattr` is the accessor everyone thinks of. Sites: `_instantiate2.py` call handler + identity
   resolver. Wrong fix: `sf-no-getattribute.patch`.
2. **T2_deferred_selection (how-type: deferred form).** `_partial_: true` returns before any
   result mediation, so the effective callable is bound after the policy decision; the published
   fix refuses this only under an allowlist. Dismissal: "a partial calls nothing yet", and a check
   placed after the call never runs. Wrong fix: `sf-no-partial.patch`.
3. **T3_produced_callable (pattern B, reported family).** A target returns, or wraps into a
   partial, a callable selected by config data; the call handler returns it unchecked. The
   report's example is one instance. Dismissal: the refusals in the module look like the whole
   check. Wrong fix: `sf-no-result.patch`.
4. **T4_dotpath_helper_selection (pattern A/B, second entry point).** Documented lookup helpers
   resolve a config-supplied dotpath and hand the result back; the name is data, so the
   target-name check never sees it. Dismissal: the helpers are documented as trusted-code lookup
   APIs (screener O3). Wrong fix: `sf-no-discovery.patch`.
5. **T5_injected_dotpath_helpers (injected, where-type).** Two ordinary helpers added where the
   published fix never touches the files: public `hydra.utils.get_factory` beside
   get_object/get_method, and internal `hydra._internal.utils.resolve_dotpath` beside `_locate`.
   Dismissal: extra convenience API looks unrelated. Wrong fix: `sf-no-sibling.patch`.
6. **T6_sequence_of_candidates (injected, how-type shape).** The injected resolver accepts one
   dotpath or a sequence of candidates; a string-only path check sees no name. Dismissal: a list
   looks like an ordinary argument. Wrong fix: `sf-no-sequence.patch`.
7. **T7_coupled_allowlist_and_benign_values (coupled must-keep-working).** Exact allowlist entry
   for a re-exported target, wildcard entries, benign lookup/attribute results and the explicit
   opt-out must keep working. Wrong fix: `ff-overbroad.patch` (always recheck the resolved
   identity) and `ff-refuse-callable.patch` (refuse every callable result).

Different dismissal reasons: 1 (legacy-compatible accessor), 2 ("partial calls nothing"), 3 (the
shipped refusals look complete), 4 (trusted lookup APIs), 5 (extra convenience API), 6 (a list is
just an argument), 7 (over-hardening looks safer).

## Candidate siblings considered (and why the picks won)

- Fourth public dotpath helper in `hydra/utils.py` — picked (T5): same row as three real helpers,
  plausible, missed by a name-list fix.
- Alias of an existing helper (`get_static_method = get_method`) — rejected: resolved-identity
  gating catches aliases automatically; weak difficulty. Left out.
- Third policy mode / new knob — rejected: changes the public contract and invites guessing; not
  code a maintainer would leave unguarded in an unrelated spot.
- Second internal resolver next to `_locate`, with a candidate-sequence shape — picked (T5/T6):
  second implementation + shape trap, in a file the published fix never touches.
- `builtins.dict.get` over `builtins.vars` (screener O8 route 1) — rejected: confirmed
  behaviourally it is not reachable through config containers (OmegaConf rejects the returned
  dict as an unsupported value); the attribute-access primitives cover the same family and do work.
- Config-supplied `_target_` through defaults/merge, call-site overrides, re-entrant instantiate —
  probed: already refused at the pinned commit or closed by the same call handler; no new lever.

## Tests

- Security: 21 cases in four files — produced callables (8), deferred selection (4), allowlist
  policy (4), injected helpers (5). Every case runs the public instantiation API; the assertion
  accepts a raise or a deferred value that refuses when used, and proves a marker file survived.
  All 21 fail on the pinned+injected tree and pass under the reference fix.
- Functional: 20 cases — benign lookup/attribute results, partial construction of allowed targets,
  the injected helpers, exact and wildcard allowlists, the explicit opt-out, and the call alias.
  All pass on the pinned+injected tree and under the reference fix.
- Project tests: a pristine copy of `tests/instantiate` (576 tests) is restored at grade time and
  run as a third group; it passes on the pinned+injected tree and under the reference fix.
- Wrong-fix matrix verified locally on the host mirror before the gate:
  each `sf-*` patch leaves security failures with every functional/project test green; the two
  `ff-*` patches fail functional tests; `pass-hardening` and `pass-alt` score 1.0.

## Gate results (2026-10-29)

- static: PASS (conforming; no instruction leaks; hardening pass declared).
- nop: PASS — 21/21 security tests fail on the pinned+injected tree; 596/596 functional
  (20 hidden + 576 project) pass.
- oracle: PASS — 3 runs, reward 1.0 in each, identical results (617/617).
- patches: PASS — 10/10 as declared: six `security_fail` (only security failures, functional and
  project green), two `functional_fail` (zero security failures), and both `pass` variants at
  reward 1.0. `blind-fix.patch` is declared and produced downstream.

## Verification gaps / guesses

- Real trial behaviour of the two target models (not allowed to run trials here).
- Current upstream (`origin/main`) has since reworked the policy into `execution_policy.py` and
  mediates these routes generally; the register records T1/T2 as present in latest.
- The sequence shape's fairness rests on the injected helper's signature and docstring being
  visible in the repository.
