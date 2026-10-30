# microsandbox-s4 build notes

- Start (UTC): 2026-10-30T00:05:38Z
- End (UTC): 2026-10-30T01:29:25Z.
- Candidate: GHSA-M8F5-RH7H-VGG3 / CVE-2026-61670 (superradcompany/microsandbox), entry_id 21243.
- Pinned (vulnerable) commit: 3773bf2f00cf4987a8e1c663bcb7508f3b21f83c.
- Published fix: 2ac6a177b11212d392bf1e7dc77aaf14e4768aa8 (identical tree to fbfb2366bfafad5e6df8778183f95fd8ca3c00a4); it applies cleanly to the pinned tree (only a docs commit sits between them).
- Pattern: A + injected. Track: injected.

## Levers (one line each)

1. NET-CONFIG (HOW-type, shape; real published-fix site): the real proxy secret value is nested inside the
   serialized network configuration on the launched command line, not in a `KEY=VALUE` pair — a fix that
   only removes the reported env loop leaves it. `sdk/rust/lib/runtime/spawn.rs:1309` at pinned.
   Dismissed as "structured configuration, not the environment loop".
2. STARTUP-ENV (real published-fix site): a second copy of the same secret values is emitted for the startup
   workload under a different flag, only when a startup command is requested.
   `sdk/rust/lib/runtime/spawn.rs:1393` at pinned. Dismissed as "a separate feature that runs after boot".
3. S-DETACHED (injected sibling, vulnerable-tree `spawn.rs:225`): the detached-spawn branch repeats the guest
   environment as `--env` pairs for the recorded/replayed launch command line. Dismissed as "a different
   launch path from the foreground run".
4. S-INIT (injected sibling, vulnerable-tree `spawn.rs:237`): the hand-off init environment is forwarded inline
   as `--env` pairs next to the encoded hand-off payload. Dismissed as "a pre-boot compatibility detail".
5. Coupled must-keep-working: the launched process must still receive the complete configuration, and the
   sandbox must stay identifiable (name, id, CPU/memory sizing, log verbosity) on the command line; a
   fix that removes everything (overbroad.patch) fails five functional tests.

The reported site itself (BASE: the plain environment loop, `spawn.rs:1322` at pinned) is also covered by a
security test and by `miss_env.patch`.

## Injected siblings: candidate list and why these two were picked

Candidates considered (screener O8/O8b leads plus my own search of the tree):

- `--startup-env` sibling next to the env loop: real upstream code, and the published fix rewrites it, so it is
  not "code the published fix never touches". Rejected as an injection (it is covered as lever 2).
- A resume/restart entry point rebuilding launch state from the persisted spec: `Sandbox::start`
  (`sdk/rust/lib/sandbox/mod.rs:705`) deserializes the stored `SandboxConfig` and re-enters the same
  `spawn_sandbox`, so no separate argv construction exists; a new one would not be reachable without a real
  VM/DB/relay, and the verifier must not boot a VM. Rejected.
- A `--config-file <path>` manual route (world-readable temp file): a file channel, outside this advisory's
  process-argument scope. Rejected (would need a second protection).
- A host-side exec helper on `crates/cli/lib/commands/exec.rs`: runs guest commands over the agent protocol,
  not a host argv; not reachable without a live sandbox. Rejected.
- The `msb` shim (`sdk/rust/bin/main.rs`) and the language bindings: they forward/re-enter the same Rust spawn
  path and never add configuration to an argv. Rejected (no independent site).
- Two argv-emission branches inside `spawn_sandbox` after the command is built (detached replay and hand-off
  init fallback): chosen. They sit outside every hunk of the published fix, so the published fix alone leaves
  them open (verified: published-fix-only = 2 security tests still fail), they are reachable through the same
  public spawn entry point, and each has a different reason to be skipped (different launch mode vs. different
  pre-boot feature).

## What was verified

- The flaw reproduces at the pinned+injected tree through `microsandbox::runtime::spawn_sandbox` with only
  `MSB_PATH`, `MSB_HOME` and `MSB_LIBKRUNFW_PATH` set: the launched child records its own `/proc/self/cmdline`,
  environment and inherited descriptors. All five security tests fail there; all six functional tests pass.
- The reference fix (published fix + removal of the two injected branches) makes all eleven pass, natively and
  end-to-end through the real verifier image.
- Wrong-fix patches, each run natively and through the verifier image: miss_env / miss_network / miss_startup /
  miss_detached / miss_init each leave exactly one lever's security test failing (miss_env leaves three, because
  the re-added loop is shared) with every functional test passing; overbroad fails five functional tests;
  hardening and alt_fix score 1.0.
- The project's own argv-rendering tests pass at the pinned commit and at the reference fix
  (`cargo test -p microsandbox --lib runtime::spawn::tests`, 38 tests, no VM/DB).
- No VM, /dev/kvm, libkrunfw, GUI, network or service is needed at grading time; the verifier image pre-builds
  the dependency graph and the hidden test binaries, and grading rebuilds only the project's own crates offline.
- Base image `rust:1.99-slim-trixie` (Debian trixie) was required: the runtime bundle the crate's build script
  downloads needs glibc >= 2.39 and cannot run on bookworm, which made the build script re-download offline.
- The pinned commit contains no copy of the published fix's regression tests (`git log` between pinned and fix
  shows only a docs commit).

## Pattern B register

No rows added: the screener's "uncovered routes" list is empty, and every real route into this sink at the
pinned commit (env, network config, startup workload, hand-off init) is in the published fix's own scope. The
two additional sites are injected, not unmodified upstream code.

## Not verified / open questions

- Repository size in MB and whether host-provided `ps` output is the only channel considered: not measured.
- Whether the prebuilt `msb` binary is ever executed at grading time: it is not (the tests put a stand-in on
  `MSB_PATH`); only the crate build script's version probe runs it.
- The hidden suites do not boot a real sandbox, so a fix that moves the configuration to a channel the real
  `msb` CLI does not read would still pass the functional suite as long as the launched process receives the
  values. The instruction states the preservation requirement in product terms; the verifier checks delivery,
  not the CLI's parser.
- Trial results (model pass/fail, blind fix) are outside this build.
