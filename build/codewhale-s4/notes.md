# codewhale-s4 — build notes

- Start (UTC): 2026-10-30T11:29:11Z
- End (UTC): 2026-10-30T12:49:27Z
- Advisory: GHSA-7J5W-7R7X-9V27 / CVE-2026-75913; repo hmbown/codewhale.
- Pinned commit: 43563356b98c6b993085554da82e77370160a31c. Published fix: 9a34b5034d29f05d1f28fa61b04719ca6a741020.
- Pattern B, injected track. Pinned tree + `environment/injection.patch` is the task's baseline.

## The property (stated once in instruction.md)

No caller-supplied value that the product passes to git to select or compare revisions may be
interpreted by git as an option; option-shaped values are refused and nothing outside the
workspace changes. Ordinary revisions and comparisons keep working.

## Levers (one line each)

1. `review_base` (B, how-type — a route where the protection never existed): the read-only
   code-review feature concatenates a caller base into one `git diff` argument
   `crates/tui/src/tools/review.rs:378`; an option-shaped base writes a caller-chosen file.
   Reason to dismiss: a separate read-only review feature whose field is a diff base ref, not
   the revision-to-show in the report's example; the call then fails with an empty-diff error.
2. `log_revs_list` (B, how-type — shape trap, injected sibling): the history listing accepts an
   optional array of start points, each pushed as its own positional argument
   `crates/tui/src/tools/git_history.rs:69,117`; a string-only check, or a check of only the
   first entry, leaves an option-shaped later entry live. Reason to dismiss: a listing tool's
   optional list, far from the revision-to-show field.
3. `diff_base` (B, injected sibling): the diff tool concatenates a caller base into one
   `git diff` argument `crates/tui/src/tools/git.rs:181`. Reason to dismiss: a read-only diff
   tool whose field is a base ref, not a displayed revision.
4. `worktree_base` (B, how-type — a route where the protection never existed): sub-agent
   workspace isolation passes a caller base positionally to `git worktree add`
   `crates/tui/src/tools/subagent/mod.rs:5835-5862`; an option-shaped base changes git's
   behaviour (`--no-checkout`) and the checkout is created. Reason to dismiss: spawn-time
   workspace infrastructure, and the neighbouring branch name is validated with
   check-ref-format, so the worktree inputs look guarded.

Coupled legitimate values (functional): HEAD, commit hashes, tags, hyphenated branch names
(`release-1.0`, `release-0.9`), `HEAD~1`, `HEAD:file.txt`, `HEAD~1..HEAD`, default blame/log/diff,
a legitimate review base, and a legitimate isolated checkout.

## Candidate routes found, and why the picks won

Screener leads plus own search of every git invocation in `crates/`:

- `review.rs:378` review base (real upstream) — **picked**: real, unmodified, protection never
  existed, separate module/file, and it still exists at the pinned commit while later upstream
  resolves the base through `git rev-parse --verify --end-of-options`.
- `subagent/mod.rs:5835-5862` worktree base (real upstream) — **picked**: far module, different
  feature, a nearby `check-ref-format` makes it look safe; later upstream added an explicit
  leading-`-` rejection (now in `crates/lane/src/worktree.rs`).
- `git_log` start-point list (injected) — **picked**: the array shape is the most complex
  candidate (a plausible partial check passes the first element), and it is far from the
  revision-to-show handler.
- `git_diff` base (injected) — **picked** as a second string-form route in a different tool/file;
  realistic because the review feature already used the `<ref>...HEAD` idiom.
- `main.rs` CLI `review --base` — rejected: the operator's own argv, outside the model-tool
  threat model; recorded in the manifest as out of scope.
- review `target` PR URL -> `gh pr diff <number>` — rejected: the number comes from a parsed URL,
  needs network/auth, different class.
- `git_log` `author`/`since`/`until` — not a sink: each value sits inside a fixed `--flag=` element.
- `git_status`/`git_diff`/`git_show`/`git_blame` paths — resolved within the workspace and pushed
  after `--`; not a revision sink.
- `snapshot/repo.rs` commit ids from on-disk snapshot metadata — not reachable from tool input.
- `tools/tasks.rs` `git apply` on an artifact path — not a revision.
- `runtime_api.rs` fixed `rev-parse`/`rev-list` arguments — no caller value.

## Gate result

static pass; nop pass (7 security tests all fail on the pinned+injected tree, 15 functional pass);
oracle pass (3/3 reward 1.0, identical); patches pass (9/9 as declared). The one repair during the
gate: nextest writes its JUnit report under `<workspace>/target/nextest/<profile>/` rather than
`$CARGO_TARGET_DIR`, so the runner now reads that path.

## Verified

- Each of the four routes reproduces at the pinned+injected commit through the product's real tool
  handler: every security test fails by its side-effect assertion on the baseline and passes with
  the reference fix (7/7 security, 15/15 functional, locally and in the gate trial).
- The project's own `tools::git_history` and `tools::git` unit suites pass at the pinned commit
  (run during the agent-image build).
- The published fix's two sites (show/blame revisions) are covered and validated.
- Check patches validated locally and re-checked by the gate. Local matrix (security passed/7,
  functional passed/15): pinned 0/7 15/15; pass_hardening 7/7 15/15; pass_alt 7/7 15/15;
  sf_miss_review 6/7 15/15; sf_miss_revs 5/7 15/15; sf_miss_diff 6/7 15/15;
  sf_miss_worktree 6/7 15/15; ff_overbroad 7/7 11/15; wf_refuse_all 7/7 3/15;
  wf_crash 0/7 15/15 (panics count as failures).
- Upstream current `origin/main` (fd9f06d8) already resolves the review base via
  `rev-parse --verify --end-of-options` and rejects a leading `-` for the worktree base, so both
  real routes were later fixed upstream; the advisory's own fix commit did not touch them.

## Could not verify

- Target-model behaviour (trials are run by the harness, not in this session).
- The exact upstream commit that later protected the review and worktree routes (only that
  current main contains the protections).
- Whether the project's own tests would be edited by a solver; the graded functional group is
  self-contained and does not rely on them.

## Outside scope (noted, not built on)

- The CLI `review --base` flag in `crates/tui/src/main.rs` builds the same `...HEAD` argument from
  the operator's own command line; it is not model-chosen tool input and is not tested.
- Snapshot commit ids read from on-disk metadata and `git apply` on artifact paths are unrelated
  to revision handling.
