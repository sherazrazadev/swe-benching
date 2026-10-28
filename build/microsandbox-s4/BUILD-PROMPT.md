# Build one security-fix benchmark task (build-v1)

## What this is
We build a security-fix benchmark from published, already-fixed advisories in open-source projects.
You build ONE task, from the advisory below.

The task pins the project at the commit just before the published fix and gives a solver agent that
code plus a short problem report (`instruction.md`). Hidden behavioural tests then score the
solver's fix. The tests check that the flaw is closed, using harmless inputs and markers, and that
legitimate use still works.

Everything stays on this machine. Describe each mechanism in one line in notes and reports; the
tests hold the detail, so never write exploitation steps out in prose. Stay inside this advisory's
own protection, in this repository, at the pinned commit. Note anything outside that scope in one
line in your report, and do not build on it.

Project root: `/home/mara/cwe-bench`. Task: `microsandbox-s4`. Pattern: `A`. Track: `injected`.

## Goal and acceptance
- **The bar.** Two target models (DeepSeek V4.1 Flash, MiMo-V2.6-Pro) must each fail all 3
  finished attempts because of their own judgement.
- **Fairness.** Everything the tests require must be findable from `instruction.md` plus the code,
  or be standard expert knowledge. A careful engineer who knows where to look fixes it in about
  45 minutes.
- **What never counts as a failure:** timeouts, and runs cut by API or network errors.
- **Proof.** A task is built only when the gate passes. A task that misses the bar is reported as
  such, never shipped weaker.

## Inputs
- Advisory: ["GHSA-M8F5-RH7H-VGG3", "CVE-2026-61670"]; superradcompany/microsandbox; Information exposure through process arguments (CWE-214): secret values written to a child process command line, world-readable via /proc/<pid>/cmdline
- Pinned (vulnerable) commit: 3773bf2f00cf4987a8e1c663bcb7508f3b21f83c. Published fix: 2ac6a177b11212d392bf1e7dc77aaf14e4768aa8, fbfb2366bfafad5e6df8778183f95fd8ca3c00a4.
- The screener's record (a lead to verify, not a fact):
  ```json
  {
 "screener_version": "screener-v2",
 "lessons_version": "lessons-v2",
 "model": "deepseek-flash[1m]",
 "entry_id": "21243",
 "advisory_ids": [
  "GHSA-M8F5-RH7H-VGG3",
  "CVE-2026-61670"
 ],
 "repo": "superradcompany/microsandbox",
 "pinned_commit": "3773bf2f00cf4987a8e1c663bcb7508f3b21f83c",
 "fix_commits": [
  "2ac6a177b11212d392bf1e7dc77aaf14e4768aa8",
  "fbfb2366bfafad5e6df8778183f95fd8ca3c00a4"
 ],
 "trust_decision": {
  "summary": "A sandbox's secret-bearing configuration (guest env, init-handoff env, and the network SecretEntry.value blob) must never be formatted onto the `msb sandbox` child process command line, because /proc/<pid>/cmdline is world-readable; the decision is made at the SDK-to-CLI spawn handoff, where the SDK assembles argv and the internal CLI re-parses it.",
  "evidence": [
   "sdk/rust/lib/runtime/spawn.rs:1310-1320",
   "sdk/rust/lib/runtime/spawn.rs:1322-1325",
   "sdk/rust/lib/runtime/spawn.rs:1402-1407",
   "crates/cli/lib/sandbox_cmd.rs:169-171",
   "crates/cli/lib/sandbox_cmd.rs:181-184"
  ]
 },
 "landing_point": {
  "where": "sdk/rust/lib/runtime/spawn.rs:1322-1325",
  "why": "The only loop that formats every sandbox env var as `--env KEY=VALUE` on the child argv; a search for where secret values reach a command line lands here first, with `--network-config` (spawn.rs:1316-1317) as the immediate neighbour."
 },
 "fix_sites": [
  {
   "where": "sdk/rust/lib/runtime/spawn.rs:1044-1391",
   "entry_point": "microsandbox::runtime::spawn_sandbox (reached by Sandbox::spawn, msb run/create/start and every language binding)",
   "module_kind": "sdk_runtime"
  },
  {
   "where": "sdk/rust/lib/runtime/spawn.rs:197-264",
   "entry_point": "spawn_sandbox command construction and pre_exec fd handoff",
   "module_kind": "sdk_runtime"
  },
  {
   "where": "crates/cli/lib/sandbox_cmd.rs:21-194",
   "entry_point": "msb sandbox CLI (hidden internal command, crates/cli/bin/main.rs:68-70)",
   "module_kind": "cli"
  },
  {
   "where": "crates/cli/lib/sandbox_cmd.rs:215-325",
   "entry_point": "msb sandbox | run() builds microsandbox_runtime::vm::Config",
   "module_kind": "cli"
  },
  {
   "where": "fix.diff:534-663",
   "entry_point": "microsandbox_runtime::launch::LaunchConfig (new public schema, crates/runtime/lib/launch.rs)",
   "module_kind": "runtime_library"
  },
  {
   "where": "crates/runtime/lib/vm.rs:60-64",
   "entry_point": "microsandbox_runtime::vm::{CONFIG_FD new, PARENT_WATCH_FD, STARTUP_FD}",
   "module_kind": "runtime_library"
  },
  {
   "where": "crates/runtime/lib/vm.rs:143-172",
   "entry_point": "microsandbox_runtime::vm::{StartupCommand, MetricsSlotHandoff} gain Serialize/Deserialize",
   "module_kind": "runtime_library"
  },
  {
   "where": "crates/runtime/lib/lib.rs:14-24",
   "entry_point": "runtime crate module exports",
   "module_kind": "runtime_library"
  }
 ],
 "O1_entry_points": 2,
 "O2_out_of_scope_site": {
  "kind": "lower_level_api",
  "where": "crates/cli/lib/sandbox_cmd.rs:21-194"
 },
 "O3_reason_to_dismiss": "`msb sandbox` is a hidden internal command (`#[command(hide = true)]`, documented as 'Run the sandbox process (internal)'), so its own --env/--startup-env/--network-config flags read as a manual/debugging surface rather than part of the leak the report describes.",
 "O4_distance": {
  "files": 3,
  "packages": 3,
  "repo_mb": null
 },
 "O5_coupled_behaviour": {
  "what": "Operator-readable labels must stay on the real argv (--name, --sandbox-id, --vcpus, --memory-mib, the log-level flag, --parent-watch-fd, --startup-fd) so the sandbox stays identifiable in ps and logs, while the piped JSON must still deliver the complete env/network config to the guest; the published fix's own test asserts labels survive and bulk/secret flags do not.",
  "where": "sdk/rust/lib/runtime/spawn.rs:1061-1088"
 },
 "O6_input_shapes": [
  "env vars as KEY=VALUE, including values merged in from the OCI image env and from init.env",
  "real secret values nested inside the NetworkConfig JSON (SecretEntry.value) rather than in --env",
  "init handoff: cmd path, args and env encoded as base64url JSON, plus cwd",
  "startup workload: cmd, args (including args beginning with '-'), env, cwd and user",
  "mounts: bind tag:host:opts, staged single-file mounts, named volumes, tmpfs specs, disk id:host:format[:ro]",
  "rlimits encoded into one MSB_RLIMITS string",
  "rootfs variants: bind path, OCI vmdk + writable upper, disk image with format and fstype",
  "optional/absent fields (workdir, user, hostname, log level, idle/max duration) and the metrics slot triple (shm name, slot, generation)"
 ],
 "O7_producer": {
  "kind": "serializer",
  "where": "sdk/rust/lib/runtime/spawn.rs:1044-1390",
  "check_calls_producer": false
 },
 "O8_uncovered_routes": [],
 "O8b_injection_room": [
  {
   "where": "sdk/rust/lib/runtime/spawn.rs:1393-1414",
   "sibling": "a second copy of the same env values on argv as `--startup-env=KEY=VALUE`, emitted only when a startup command is requested",
   "why_realistic": "a maintainer adding 'run this workload after boot' naturally forwards the sandbox env to the workload and reuses the easiest channel, the argv the process already parses"
  },
  {
   "where": "crates/cli/lib/sandbox_cmd.rs:215-325",
   "sibling": "a resume/restart entry point that rebuilds the launch config from the persisted sandbox spec and re-executes `msb sandbox` with the old flag set",
   "why_realistic": "msb start already re-spawns a stopped sandbox from stored config (sdk/rust/lib/sandbox/mod.rs:705), so a separate resume path that restored argv rather than the fd payload is a natural refactor"
  },
  {
   "where": "sdk/rust/lib/runtime/spawn.rs:197-264",
   "sibling": "a `--config-file <path>` manual route that writes the JSON launch config to a named, world-readable temporary file instead of an unlinked fd",
   "why_realistic": "the published fix itself adds exactly this debugging route, so a maintainer could ship it as the only handoff and leak the same secrets through a different, file-shaped channel"
  },
  {
   "where": "crates/cli/lib/commands/exec.rs:100-150",
   "sibling": "a host-side exec helper that spawns a local process with the merged exec env on its command line",
   "why_realistic": "exec already merges sandbox env with caller env (sdk/rust/lib/sandbox/mod.rs:1628-1673) and a local fallback runner is an easy convenience addition"
  }
 ],
 "O9_family": "Information exposure through process arguments (CWE-214): secret values written to a child process command line, world-readable via /proc/<pid>/cmdline",
 "O9_dos": false,
 "O10_build": {
  "language": "Rust (edition 2024 workspace, 36 members, 5 crates touched)",
  "toolchain": "cargo/rustc >= 1.85 for edition 2024; C toolchain for msb_krun 0.1.17 (features blk + net); no rust-toolchain file in the tree",
  "services": [],
  "offline_after_build": true,
  "project_tests": "Pure arg-construction tests in `sdk/rust/lib/runtime/spawn.rs` #[cfg(test)] mod tests (render_args at spawn.rs:1486 uses LocalBackend::lazy(), no DB/FS) and unit tests in `crates/cli/lib/sandbox_cmd.rs` (mod tests from ~line 400). Integration tests under sdk/rust/tests spawn a real VM and need /dev/kvm + libkrunfw."
 },
 "O11_fix_minutes": 90,
 "O12_red_flags": [],
 "O13_recall_risk": "low",
 "pattern_fit": "A",
 "j": {
  "j_multi_site": 1,
  "j_sites_touched": "crates/cli/lib/sandbox_cmd.rs, crates/runtime/lib/launch.rs, crates/runtime/lib/lib.rs, crates/runtime/lib/vm.rs, sdk/rust/lib/runtime/spawn.rs",
  "j_sibling_sites": "no",
  "j_cause_other_layer": 1,
  "j_defence_ineffective": 0,
  "j_overbroad_breaks_legit": 1,
  "j_tempting_wrong_fix": "Stop emitting `--env` in the SDK (or scrub secret values where SandboxBuilder::env is called) while leaving `--startup-env`, `--network-config` and the CLI's own flag schema on argv"
 },
 "out_of_scope_notes": [
  "The same SecretEntry.value also round-trips through the persisted SandboxConfig network spec (sdk/rust/lib/sandbox/config.rs:467-472); any exposure via the on-disk sqlite store is a file channel outside this advisory's process-argument scope and was not pursued."
 ],
 "unverified": [
  "Repository size in MB could not be measured (no shell/du available); repo_mb left null, and tiny_repo/giant_repo were not asserted.",
  "Build was checked statically only: the two fix commits carry identical patch bodies in scr-21243.fix.diff and no cargo invocation was possible, so whether msb_krun 0.1.17 needs libkrun/libkrunfw headers at compile time is unverified.",
  "The advisory text itself was not available; scope was taken from the summary line and the fix diff.",
  "Whether secret values are written into the sandbox sqlite DB (out_of_scope_notes) was not checked.",
  "Whether `--mount`/`--disk` host paths or `--db-path`/`--log-dir` are sensitive in the project's threat model was not established; only env, init env and network secrets are evidenced as secret-bearing."
 ]
}
  ```
- Published fix sites:   - sdk/rust/lib/runtime/spawn.rs:1044-1391 — entry point: microsandbox::runtime::spawn_sandbox (reached by Sandbox::spawn, msb run/create/start and every language binding) [sdk_runtime]
  - sdk/rust/lib/runtime/spawn.rs:197-264 — entry point: spawn_sandbox command construction and pre_exec fd handoff [sdk_runtime]
  - crates/cli/lib/sandbox_cmd.rs:21-194 — entry point: msb sandbox CLI (hidden internal command, crates/cli/bin/main.rs:68-70) [cli]
  - crates/cli/lib/sandbox_cmd.rs:215-325 — entry point: msb sandbox | run() builds microsandbox_runtime::vm::Config [cli]
  - fix.diff:534-663 — entry point: microsandbox_runtime::launch::LaunchConfig (new public schema, crates/runtime/lib/launch.rs) [runtime_library]
  - crates/runtime/lib/vm.rs:60-64 — entry point: microsandbox_runtime::vm::{CONFIG_FD new, PARENT_WATCH_FD, STARTUP_FD} [runtime_library]
  - crates/runtime/lib/vm.rs:143-172 — entry point: microsandbox_runtime::vm::{StartupCommand, MetricsSlotHandoff} gain Serialize/Deserialize [runtime_library]
  - crates/runtime/lib/lib.rs:14-24 — entry point: runtime crate module exports [runtime_library]
- Uncovered routes to confirm (pattern B): none
- Design plan from the lead: No lead plan is provided for this task — you are the lead as well as the builder. Using the Design section above and the screener record, design the task yourself and WRITE YOUR PLAN in `notes.md` BEFORE you build:
  - choose the main lever and at least one more, each with a DIFFERENT reason a solver would dismiss or skip it. The main lever must be HOW-type (its fix needs the mechanism understood: a producer the check never calls, a coupled must-keep-working value, a shape a plausible check mishandles, a route where the protection never existed); another entry point or a planted copy is only an extra;
  - decide the sites, routes and input shapes the security tests will cover;
  - identify the coupled must-keep-working behaviour next to each lever, for the functional tests;
  - for the injected track: decide the realistic sibling gap(s) to add — each must be code a maintainer could plausibly have left, reachable through the real entry point, covered by the task's one general property (never by a sentence of its own), and placed where the published fix never touches. First list EVERY possible sibling site and route you can find (the screener's O8/O8b leads plus your own search of the code). Then pick 2–4 of them: the most complex and hardest to find of all the candidates (how-type over where-type, far from where the report leads, with a plausible reason to dismiss), each with a different reason a solver would skip it. Record the full candidate list, and why each pick beat the others, in notes.md;
  - write the security property ONCE, in general terms over the protected data or outcome, before choosing routes. Every route and sibling must fall under it as written; the report must not describe where any of them lives;
  - if this candidate cannot support a fair task that meets the bar (flaw does not reproduce at the pinned commit through a real entry point, needs network/GPU/GUI at run time, or no design meets the bar), STOP and report why. Do not ship a weak task.
Follow every rule in the Design, Report, Tests and Proof sections exactly. You choose the design; the rules are fixed.
- Host notes: none

## Design: where difficulty comes from
Models find the code the report leads to and diagnose it correctly. They fail on scope. Build these
in, in order of evidence:
1. **Pattern A: the published fix's far sites.**
   - The report leads to one site. The tests cover every entry point the published fix protects,
     including one in a module that looks out of scope: a second implementation, a lower-level
     public API, a wrapper, a save/reload path, or a defaults or merge route.
   - Give it a plausible **reason to dismiss**, and **distance**: another file or package from the
     landing point.
   - **A second implementation is the strongest form of this**: separate code doing the same
     guarded operation (a fallback backend, another package, another transport, a legacy version),
     so fixing the reported copy changes nothing in the other. Models fix the copy the example hits,
     re-run the example and stop. Prefer a real one (Pattern A or B) over a planted one. Find
     candidates by searching for the low-level primitive across packages (redirect following,
     header copying, file writes, message construction). It only counts if the report never
     describes it.
2. **Pattern B: uncovered routes.**
   - Routes into the same protected sink where the advisory's own protection is missing at the
     pinned commit, and which the published fix did not touch.
   - They are unmodified upstream code. A solver may argue they were never covered, but the task's
     general property covers them, so leaving one open is a model failure, not out of scope. The
     same holds for a route where the protection never existed: the property requires it.
   - Make sure the property, read literally, really covers each route (no word that excludes it),
     and that its test fails only when the protection is really missing (it must pass a correct
     fix placed at any valid layer).
   - The strongest lever found so far: DeepSeek 6 of 6 on one; both models 0 of 3 on three combined.
3. **Shape traps: an input form that a plausible check mishandles.** Examples: a value given as an
   array where the check only handles a string; a name split on the first separator when it can
   contain the separator; a resolved path against a lexical check; a rename or rewrite that happens
   after the check; a nested expression the check never inspects. Two conditions: the general
   property must cover the form literally, and the form must not fall inside anything a
   must-keep-working clause or a test fixture calls legitimate. A pure spelling, encoding, verb,
   protocol or role variant of a stated input is NOT a shape trap: both models always catch those
   (see "Never add").
4. **A coupled must-keep-working behaviour** next to the sink, tested functionally, so an
   over-broad fix fails. MiMo tends to over-harden.
5. **Producer off the check's path.** The check depends on data produced elsewhere (a schema,
   serializer, cache, mapper, table builder or config loader) and does not call it; the data
   reaches the check on a separate path (saved and reloaded, rebuilt from config). The fix needs
   both the check and the producer. Models trace into what the check calls, never back to where
   its data comes from. Rules:
   - it counts only if the producer is infrastructure, not a request handler;
   - verify that the check does **not** call the producer; if it does, the model follows the call
     and fixes it;
   - the report describes impact only through the check's path and states the property abstractly
     ("including data saved earlier"); it never points at the producer or the reload path;
   - avoid fixes where the check cannot compile without the producer change (that forces the find);
   - hidden tests must not need a field or function name the solver would have to guess;
   - prefer a producer deep in internal machinery (a table or schema builder). One behind a path
     that is easy to follow falls as soon as anything points at it.
6. **Injected siblings**, only where the plan asks for them. Each must be:
   - code a maintainer could have written, with no deceptive names or comments;
   - reachable through the real entry point;
   - covered by the task's general property, never by a sentence of its own;
   - placed where the upstream fix never touches.
7. **Wrong object.** The authorization check exists but decides on a different object than the one
   the request actually touches: a neighbouring or proxy resource (a parent or container instead of
   the item written), or an identity field the caller supplies (an account inside a caller-provided
   resource name; a parent read from one part of the request while the write uses another). Models
   copy the nearby precedent. Rules:
   - the instruction names the protected object class in product terms ("the objects that hold the
     limits"), never the check or its location;
   - the security test denies exactly the object touched while the proxy object stays allowed;
   - a functional test keeps a legitimate request on that same object working.
8. **Ordering.** The check is right but runs at the wrong moment: after an adjustment turns the
   attacker's value into a different bad value (an offset, a clamp, a unit conversion, a
   normalisation), or after a side effect has already happened (a directory created, a file cleared,
   copied or re-permissioned, a request sent) before the refusal. Rules:
   - the instruction states the property over the attacker's input or the outcome ("nothing outside
     the folder is created or changed, even when the request is refused"), never the order of steps;
   - the security test checks the side effect itself, not only the response;
   - any fix that keeps the property passes, wherever it places the check.
9. **Route where the protection never existed.** Real code reaches the protected sink but never had
   the check at all, so its absence reads as design (DeepSeek missed one 6 of 6 times). Rules:
   - it needs a plausible reason to dismiss: an unsupported combination, a legacy path, a
     neighbouring feature. If the project documents the protection as applying everywhere with no
     exceptions, there is no reason to dismiss and the route adds nothing;
   - the general property must cover it literally; never describe it in the instruction;
   - confirm it with a behavioural test on the pinned copy, like any Pattern B route.
10. **Merged or defaults route.** The restricted value reaches the sink through defaults, a merge,
    inheritance, a patch, or stored configuration rather than the request field the report shows.
    Models treat the report's example fields as the whole set. Rules:
    - state the property over the sink ("anything a submitter supplies that ends up in X, however
      it gets there"), not over the entry or field;
    - the security test drives the merged or stored route through the real entry point;
    - a functional test keeps legitimate defaults and merges working.

Aim for at least two levers with **different** reasons to dismiss.

**At least one lever must be how-type**: its fix needs the mechanism understood, not only found.
How-type levers are a producer off the check's path (5), a coupled must-keep-working value (4), a
shape that a plausible check mishandles (3: a separator split, a rename after the check), and a
route where the protection never existed. Where-type levers (another entry point into the same code,
a second copy, injected siblings) only cost a search. They held only when the report stayed general,
so count them as extras, never as the task's main difficulty.

Never add:
- encoding, verb, protocol or role/direction variants;
- more routes of one concept;
- resource-exhaustion traps.

Every lever must be findable by a blind engineer from the report and the code. A lever that a blind
fix cannot find is unfair: remove it.

**Pattern B rules:**
- Confirm each route with a behavioural test on the pinned copy before relying on it. The
  screener's claim is only a lead.
- Append one row per route to `/home/mara/cwe-bench/build/audit/uncovered-routes.tsv`, using its existing
  header. Columns:
  - `task`, `repo`, `advisory`;
  - `trap_ref` (the manifest trap id only; no mechanism text, since the manifest holds the detail);
  - `real_upstream`;
  - `present_in_latest` (`yes`, `no` or `unknown`, from a read-only look at current upstream code if
    you can reach it);
  - `public_upstream_report`, `in_current_scope`, `built`, `note`;
  - `disclosure_status` (`pending client decision`).

## Environment (`tasks/microsandbox-s4/environment/Dockerfile`)
- **Base and code.** A small official base image. The repo goes into `/app` at the pinned commit,
  and `/app/.git` is then deleted.
- **Offline.** Install every dependency, tool and service the project and tests need; nothing may
  be downloaded at test time. Services start from `test.sh`.
- **Packages:** `patch`, `curl`, `ca-certificates`, `bash`, `git`.
- **Agent layer.** Append `common/trial/claude-code.Dockerfile.snippet` unchanged at the end.
- **No test code in the image.** The agent shares the container. Pre-build against stubs; `test.sh`
  copies the real tests in at grading time.
- **Project tests.** The project's own tests for the affected area must pass in the image at the
  pinned commit.
- **No leaked regression tests.** The pinned commit must not already contain the advisory's
  regression tests (check `git log` between the pinned and fix commits).

## Report to the solver (`tasks/microsandbox-s4/instruction.md`)
**Write:**
- what the system is, at product level;
- one observed impact, with ONE concrete trigger at user level (HTTP request, CLI call or public API
  use);
- the security property as an **invariant**, stated once in general terms: who may do what to which
  data, or what attacker input must never achieve ("no value of X may …, however it arrives"). It is
  fair when, read literally, it covers every tested route and shape; it must not point at any of
  them. Write a second property only for a genuinely different protection, never one per route,
  and never a count;
- every **contract** the tests need, each stated once for the whole product, never per route:
  - the refusal form ("a client error with no side effect");
  - any interface or field name a test uses, stated so it applies everywhere. If a sibling's test
    would need a contract that only that sibling uses, change the test so it does not, or drop the
    sibling;
  - preservation clauses ("everything that works today keeps working exactly as today"). Name a
    coupled legitimate value in property terms ("visible values keep binding even next to a hidden
    one"), not by the feature or route it sits on;
  - a legitimate magnitude next to any attack magnitude;
- that examples are examples, not the full set;
- the standard constraints block: fix the problem and its close variants; keep legitimate use
  working; do not look up the upstream fix; do not special-case the
  example.

**Never write:**
- file, package, function, class, field or parameter names a user would not see;
- line numbers, the root cause, the fix approach, or a CVE or GHSA id;
- a list of routes, spellings or roles;
- restricting adverbs ("directly", "only via");
- anything that names or paraphrases a far site, an uncovered route or an injected sibling;
- any clause that describes where a far site, uncovered route or injected sibling lives, even in
  product terms: no route, operation, command, channel, object kind, stage or format that points
  at one of them. State each property once, over the protected data or outcome, so it covers every
  route without pointing at any;
- a word that is general but is also the name of one stage or entry point ("loading" when the
  product has a load call). Pick wording that cannot be read as one surface.

Check before you finish: for each sentence of the report, ask whether it exists to cover one
specific route or trap. If it does, delete it or widen it into the general property.

Put every identifier that must not appear in `manifest.leak_terms`.

## Tests (`tasks/microsandbox-s4/tests/`)
- **`security/`:** one test per site, route, input shape and form. Each one:
  - goes through the real entry point;
  - fails on the pinned code and passes on a correct fix;
  - asserts the attack is blocked: any client error plus no side effect, never one exact status.
- **`functional/`:**
  - legitimate use, including the coupled behaviour of every lever;
  - where they exist, the project's own tests for the area.
- **No product code in a test's bookkeeping.** Compute expected values and clean-ups in the test
  itself, because a hardened helper must not crash a test.
- **Stubs** of permission or authority answer per resource and verb, like the real thing.
- **Scope.** A test may vary only what the instruction names, and drive only the entry point it
  names.
- **No network**, and nothing that depends on the fix commit being present.
- **Templates.** JUnit XML into the two directories the template names. Copy `score.py` unchanged.
  Edit only the marked command lines of `test.sh`, and keep its agent-kill block.

## Proof
- **The oracle.** `solution/fix.patch` is the published fix reduced to source changes, plus fixes
  for every uncovered route and injected sibling in the task. `solution/solve.sh` applies it to
  `/app`.
- **Wrong-fix patches** go in `build/microsandbox-s4/checks/`, listed in `manifest.patch_checks`:
  - one `security_fail` per lever (the fix that misses only that lever);
  - a `functional_fail` (an over-broad or feature-removing fix);
  - a `pass` of kind `hardening` (the oracle plus defensive hardening of the product code the
    security tests import);
  - a `pass` alternative fix where a second valid design is plausible.
- **`manifest.wrong_fix_catalogue`:** for each class, a `checks/` patch, or `n/a: <why>`:
  `refuse_all`, `crash_as_refusal`, `wrong_resource`, `one_role_or_direction`, `reads_only`,
  `check_after_adjustment`, `unlisted_route`, `malformed_identity`, `missing_authority`,
  `adjacent_api`.

## Deliverables
**`tasks/microsandbox-s4/`:**
- `instruction.md`;
- `task.toml`, from `common/builder/templates/`, with `[metadata]` (incl. the delivery fields) filled in and
  `network_mode = "no-network"` (no allowlist);
- `environment/Dockerfile`;
- `solution/solve.sh` and `solution/fix.patch`;
- `tests/test.sh`, `tests/score.py`, `tests/security/` and `tests/functional/`.

**`build/microsandbox-s4/manifest.json`:**
- `slug`, `candidate`;
- `pattern`: `A`;
- `builder_prompt_version`: `build-v1`;
- `"strict_gate": true`;
- `verified`: entry point, sites, routes, services, project tests run;
- `leak_terms`, `patch_checks`, `wrong_fix_catalogue`;
- `traps`: one entry per lever, with `shape`, `where` (file:line), `security_tests`,
  `coupled_functional_tests`, `security_fail_patch`, and `realistic_because` (for pattern B: "real,
  unmodified upstream code");
- `status`.

**Also in `build/microsandbox-s4/`:**
- `checks/*.patch`;
- `notes.md`: start and end UTC, each lever in one line, what you verified, what you could not.

Pattern B: the register rows (see Design).

Use `common/builder/templates/` and `common/trial/smoke-task/` for the layout.

## Run the gate
Run the stages in order, one at a time:
```
python3 -I common/gate/gate.py microsandbox-s4 --only static
python3 -I common/gate/gate.py microsandbox-s4 --only nop
python3 -I common/gate/gate.py microsandbox-s4 --only oracle
python3 -I common/gate/gate.py microsandbox-s4 --only patches
```
In static, only the missing `blind` patch and the missing `FAIRNESS.md` may remain; others write
those after you. Do NOT write them yourself, and do NOT run trials or any target model.

## Machine and files
- **The machine:** one shared 8-CPU / 12 GB Docker VM that is running trials.
  - At most one Docker build or gate stage of yours at a time.
  - Never prune Docker images or the build cache.
  - Never stop containers you did not start.
- **Files:**
  - scratch work goes in `~/.tb-graders/cwe/work/microsandbox-s4/`;
  - edit only `tasks/microsandbox-s4/`, `build/microsandbox-s4/` and, for pattern B, the register;
  - do not commit.

## Stop and report instead of shipping when
- the flaw does not reproduce through a real entry point at the pinned commit;
- a planned route or site is not reachable, or the check calls the producer directly (substitute
  another lever the code supports if you can, and say so);
- the task needs network at run time, or a GPU, kernel or GUI;
- the tests are flaky;
- no design meets the bar.

## Report back (under 400 words)
- The gate result for each stage.
- Each lever in one line: pattern, shape, file:line, reason to dismiss.
- Pattern B: each register row.
- The instruction's word count.
- Every guess you could not verify.
- Any fairness concern you see yourself.
- Anything noticed outside the scope, in one line.
- If abandoned, exactly why.
