# git-js-s5 build notes

- Start (UTC): 2026-10-28T20:41:15Z
- End (UTC): 2026-10-28T21:03:04Z
- Pattern: A+B. Track: injected. Advisory: GHSA-X6JW-M9V5-85VH / CVE-2026-102828
  (CWE-184 incomplete denylist in the unsafe-argv guard; leads to CWE-78).
- Repo: `steveukx/git-js` (simple-git + `@simple-git/argv-parser`), pinned
  `76f308ed445013d8dd973bc515e7815b59426e3e`, published fix
  `d762810c13b331ff1e5eb24c0b434646d2a8d1b3` (verified parent of the fix commit).

## What the product is, in one line

`simple-git` builds a git child-process argv and passes it through one argv guard
(`blockUnsafeOperationsPlugin` -> `vulnerabilityCheck`), which parses argv and the task
environment and refuses argv that could make git run a caller-named program, unless the
matching `unsafe.*` opt-in is enabled.

## Protected outcome (one property, written once)

No value supplied by the application's caller may cause `git` to run a program of the
caller's choosing, however the library passes that value to `git`, unless the application
has enabled the existing opt-in that permits caller-chosen programs. Every such value is
refused before a child process starts.

## Levers (one line each)

- **T1** (A, base/report site): the flat configuration-key denylist has no
  `trailer.<token>.cmd` / `trailer.<token>.command` rows, however the write is carried
  (positional, inline `-c`, `--config`, `--config-env`, numbered environment).
  `packages/argv-parser/src/vulnerabilities/detect-vulnerable-config-writes.ts:39-72`.
  Dismiss: the docs call the blocks a non-exhaustive safety net, and trailer formatting
  does not read like a command-binary row.
- **T2** (A, published-fix far site, HOW-type): no rebase `-x`/`--exec` matcher, and the
  per-command switch table has no rebase entry, so `-qx`/`-ix`/`-x<cmd>` stay opaque to the
  tokeniser and are not matched even after a naive row.
  `packages/argv-parser/src/vulnerabilities/detect-vulnerable-flags.ts:65-79`,
  `packages/argv-parser/src/tokens/flag-specs.ts:43-102`.
  Dismiss: the option table is a lower-level parsing schema, not a security check, and the
  rebase half is a separately credited report in the same commit.
- **T3** (B, real unmodified upstream, HOW-type): a section rename reports the source
  section as the written key and the destination only as its value, so the created name is
  never classified; both the `--rename-section` option and the `rename-section` verb have
  this shape. `packages/argv-parser/src/config/detect-config-action.ts:42-55`.
  Dismiss: a rename is a structural edit, not a key/value write; the docs cover known
  high-risk patterns only.
- **T4** (B, real unmodified upstream, HOW-type producer): the packed configuration
  environment channel is mapped to the "config from env" opt-in but its keys are never
  unpacked, so with that opt-in enabled, keys inside it never reach the key denylist.
  `packages/argv-parser/src/env/parse-env.ts:20-45,70-86`.
  Dismiss: the variable is already refused wholesale unless the config-env opt-in is on,
  so it reads as covered; the docs describe only the numbered variables.
- **I1** (injected, HOW-type producer): a new typed operation runs a caller-supplied
  command once per submodule. The command is a positional operand, and the vulnerability
  analysis is handed only the task, the flags and the configuration - positionals are
  produced by the parser but never reach the check.
  `simple-git/src/git.mjs` (new method) + `packages/argv-parser/src/args/parse-argv.ts:19-30`
  + `packages/argv-parser/src/vulnerabilities/vulnerability-analysis.ts`.
  Dismiss: `foreach` reads as iteration/display rather than program execution, and a fix
  confined to the flag/config collectors still cannot see the operand.
- **I2** (injected, where-type extra): a new typed operation exposes the deprecated
  filter-branch filter switches, which name programs, with no denylist rows.
  `simple-git/src/git.mjs` (new method).
  Dismiss: a deprecated command whose filters look like content transformations.

## Candidate list (every sibling/route looked at) and why the picks beat the rest

Real upstream routes found (unmodified code, reachable at the pinned commit):
1. `--rename-section` / `rename-section` destination section (T3). PICKED - how-type,
   needs the check's object changed, far from the report's key row.
2. Configuration operands after the `--` separator (stacking-style T6). NOT PICKED - same
   concept as T3 (config action parsing); would be a second route of one idea.
3. `GIT_CONFIG_PARAMETERS` packed environment (T4). PICKED - how-type producer, the check
   never calls the producer that could unpack it; distinct from every other lever.
4. `GIT_DIR` / `GIT_WORK_TREE` environment not mapped (where a directory can deliver
   arbitrary config). NOT PICKED - an env spelling of the already-stated `--git-dir` route;
   closer to an encoding/variant lever than a new mechanism.
5. `GIT_CONFIG_COUNT` numbered environment (already parsed). NOT PICKED as a lever - the
   published key fix covers it; used only as a T1 input shape.
6. `git grep -O` / `--open-files-in-pager`, `git archive --exec`, `git bisect run`,
   `git submodule foreach`, `git filter-branch --*-filter`, `git difftool -x/--extcmd`.
   These are real unguarded command-running surfaces. `submodule foreach` and
   filter-branch were picked for injection as typed operations (I1/I2) because they give
   caller-controlled values through a public method. `bisect run` was not picked (same
   positional mechanism as I1; one positional concept is enough). `grep -O`, `archive
   --exec` and `difftool -x` were not picked (same flag-denylist concept as T2/I2).
7. `core.alternateRefsCommand` and other unlisted command-naming config keys (noted by the
   screener). NOT PICKED - a flat-row-only lever (where-type), and it was not verified.

Injected candidates considered:
- A late-registered constructor option that pushes configuration through the environment
  after the guard. NOT PICKED - the values are supplied by the application developer, not
  the application's caller, so the task's own property would not cover them.
- A second guard implementation or a task that spawns directly. NOT PICKED - not plausible
  in this codebase; every task funnels through one executor and one guard.
- `submoduleForeach` typed operation (I1). PICKED - caller input, how-type (the operand
  producer is off the check's path).
- `filterBranch` typed operation (I2). PICKED - caller input, realistic deprecated-command
  surface, placed in files the published fix never touches.

## Sites and entry points the hidden tests drive

- Public library API only: `simpleGit()` typed operations (`raw`, `rebase`, `config`
  helpers are not needed) and `.env()` for the task environment; child process is a
  recording stand-in supplied through the library's own `binary` option.
- Security: trailer config writes (positional / inline / `--config` / `--config-env` /
  numbered env), rebase exec switch (`-x`, `--exec`, embedded, abbreviation, clusters,
  attached value), section-rename destination, packed env configuration, submodule
  iteration command (typed + raw), filter-branch filter switches (typed + raw).
- Functional: trailer metadata keys and separators; ordinary settings in every config
  channel; ordinary renames; strategy/interactive/`-X` rebase options; the clean switch of
  the same letter (raw and typed); the exec-path getter; `push --exec` keeping its own
  opt-in category; safe packed environment configuration; submodule status/summary;
  filter-branch without filters; ordinary positionals; opt-in behaviour for every lever;
  the project's own argv-parser suite (minus the one pre-fix rename-semantics case) and the
  affected simple-git unit suites.

## Coupled must-keep-working behaviour per lever

- T1: trailer formatting keys (`trailer.<token>.where|ifExists|ifMissing|layout`),
  `trailer.separators`, ordinary settings, and the same key under the command-binary
  opt-in.
- T2: rebase `-s <strategy> -X <option> -i`, capitalised `-X`, non-exec clusters,
  `clean -x` and typed `clean('dfx')`, `--exec-path` as a getter, and `push --exec`
  keeping only the pack opt-in.
- T3: ordinary section renames in both spellings.
- T4: a safe key through the packed channel under the config-env opt-in.
- I1: `submodule status`/`summary`, ordinary positionals, and the operation under the
  exec opt-in.
- I2: filter-branch without filter switches, and filter switches under the exec opt-in.

## Injection design (track=injected)

`injection.patch` adds two public typed operations in `simple-git/src/git.mjs` plus their
typings: one runs a caller-supplied command per submodule (positional operand), the other
exposes the deprecated filter-branch filter switches. Both are ordinary library methods in
files the published fix never touches; neither instruction sentence names them.

## Verified (local, pinned + injected tree)

- All planned security shapes reach the recording child process on the pinned tree
  (spawn) and are refused under the reference fix (no spawn, thrown error).
- All planned functional shapes spawn on both trees.
- Project argv-parser suite: 207 pass / 4 skipped on pinned; the one rename-semantics case
  is excluded from the verifier copy because a correct fix necessarily changes it.
- The reference fix was applied to the pinned tree and the hidden suites pass locally.

## Could not verify

- present_in_latest for the real upstream routes: no current upstream tree was read.
- The two injected operations do not exist upstream (our copy only).
- Whether a real git binary would run the command for every shape; the tests observe the
  guard boundary with a recording stand-in, which is the property the task states.

## Outside scope noticed (one line)

The screener's note about further unguarded command-naming flags (`git difftool -x`, `git
grep -O`) was not verified and was not built on beyond the two typed operations above.

## Gate results

- `static`: PASS (2026-10-28T20:41Z).
- `nop`: PASS - 27/27 security tests fail on the pinned + injected code, 319/319
  functional tests pass (29 hidden + 206 project argv-parser after the excluded
  rename-semantics case, with 4 permanently disabled upstream cases skipped + 90
  project simple-git unit cases). Trial
  `git-js-s5-nop-1793220597/git-js-s5__4JMVXaH`.
- `oracle`: PASS - 3 runs, reward 1.0 each, 27/27 security and 319/319 functional each,
  identical results. Trials `git-js-s5-oracle{1,2,3}-*`.
- `patches`: PASS - every check behaved as declared:
  - `miss_t1.patch` security_fail (13 security fail, 0 functional fail)
  - `miss_t2.patch` security_fail (8 / 0)
  - `miss_t3.patch` security_fail (3 / 0)
  - `miss_t4.patch` security_fail (3 / 0)
  - `miss_i1.patch` security_fail (3 / 0)
  - `miss_i2.patch` security_fail (3 / 0)
  - `sf_row_only.patch` security_fail (4 / 0)
  - `ff_case_insensitive.patch` functional_fail (0 security fail, 2 functional fail)
  - `ff_global_x.patch` functional_fail (0 / 4)
  - `ff_overbroad.patch` functional_fail (0 / 184)
  - `pass_hardening.patch` pass (reward 1.0)
  - `pass_alt.patch` pass (reward 1.0)
  - `blind.patch` listed for the downstream blind pass; not written here.

The checks stage ran with the gate's two global Harbor slots; each stage wrote
`build/git-js-s5/gate_report.partial.json`. No full-gate re-run was made after the
four ordered stages.

## Fairness revision (2026-10-29)

- instruction.md generalized per FAIRNESS.md "Required: generalize" items 1-8: removed the
  API/key example, the channel/stage framing, the variant list and the flaw count, and
  stated the property once; "ordinary arguments" wording replaced with "Values that do not
  name a program keep working, however they are supplied." The opt-in contract now says
  each invocation asks only for the opt-in governing the capability it uses.
- Abbreviation security tests run with `unsafe.allowAbbreviatedOptions` so a real git
  accepts `--ex`/`--exe` as `--exec` (AUDIT-FINDINGS item 3).
- Opt-in categories pinned: functional opt-in cases enable only the governing category;
  new security cases prove the non-governing opt-in does not permit the same capability.
- Added packed-environment mixed-case and space/quote-value security cases, `--ex`, and a
  functional `submodule status` operand that merely equals `foreach`.
- `pass_alt` packed-environment parser made quote-aware so the space/quote case passes.
- Security cases 27 -> 34; hidden functional cases 29 -> 30.
- Not applied (Quality, non-blocking): the `parse-env.spec.ts` modern-form fixture change.
  Asserting the modern `'core.pager'='cat'` form after unpacking adds `allowUnsafePager`,
  which fails on the pinned tree (nop); keeping the old expectation fails on the reference
  (oracle). It cannot be applied without weakening the exact assertion, so the legacy-form
  row is left as upstream shipped it.

## Fairness re-gate (2026-10-29)

Run one stage at a time after the changes above:

- `static`: PASS.
- `nop`: PASS - 34/34 security fail on the pinned + injected tree, 320/320 functional pass
  (30 hidden + 206 project argv-parser after the removed rename case + 90 project
  simple-git; duplicate `it.each` names reduce 326 cases to 320 unique).
- `oracle`: PASS - 3 runs, reward 1.0 each, 34/34 security and 320/320 functional,
  identical results.
- `patches`: PASS - 13/13 as declared:
  - miss_t1 security_fail (16 / 0), miss_t2 (10 / 0), miss_t3 (3 / 0), miss_t4 (5 / 0),
    miss_i1 (4 / 0), miss_i2 (4 / 0), sf_row_only (4 / 0)
  - ff_case_insensitive functional_fail (0 / 2), ff_global_x (0 / 4), ff_overbroad (0 / 184)
  - pass_hardening, pass_alt and blind each reward 1.0.
