# language-servers-s4 — build notes

Start (UTC): 2026-10-28T23:50:37Z. End (UTC): see the last line.

Task: amazon-q-developer/language-servers at ae7d3fcd (parent of the published fix
7b8595a4 + f5aa1a3b). CWE-732: configuration shipped in an opened workspace drives
process execution and remote connections without user consent. Pattern A+B, injected track.

## Levers (one line each)

- **T1 (main, how-type, pattern B, real upstream)** — The approval identity is computed from
  the config entry, but for registry servers the workspace-supplied environment is produced by
  the loader into `__additionalEnv__` and merged only at spawn; a post-approval change to it is
  never re-asked. Dismissal: "the registry pins the command, an env tweak is a benign setting".
  Fixed later upstream at 529aed432595.
- **T2 (pattern B, real upstream)** — Matching an approval on server name + workspace (or on
  either hash) lets one approved configuration authorise a changed one, an edited saved server,
  and an identical configuration in another workspace. Dismissal: "approval is per workspace,
  re-prompting is churn". The published f5aa1a3 introduced this OR; upstream restored the
  conjunction at 1c84ba6c89a2.
- **T3 (injected, how-type)** — When a workspace legacy entry overlays a same-named global
  agent-config entry, the merged record keeps the global source path, so trust is decided on the
  record's origin rather than the file that supplied the executing settings. Dismissal:
  "the server was already defined by the user". Injected in `loadAgentConfig` (mcpUtils.ts).
- **T4 (injected, route where the protection never existed)** — Lifecycle commands declared by
  a workspace agent configuration are executed at discovery outside the server-start gate.
  Dismissal: "hooks are not MCP servers". Injected as hook collection + `runAgentSpawnHooks`.

Entry-point coverage beyond the levers (pattern A): `addServer`, `updateServer`, remote URL,
dialog-unavailable fail-closed.

## Full sibling candidate list (screener leads + my own search)

1. Registry `__additionalEnv__` not in the approval identity — **chosen (T1)**. Real code,
   producer off the check's path, reachable offline.
2. Approval identity keyed by workspace only / OR match — **chosen (T2)**. Real code in the
   published fix, reachable across reloads and workspaces.
3. A fourth `__`-prefixed overlay (`__additionalArgs__`/`__additionalCwd__`) merged at spawn —
   rejected: same concept as T1, they fall together.
4. `__additionalHeaders__` not in the identity — rejected: same overlay concept and no code
   execution; still covered by the reference identity defensively, not scored.
5. Workspace agent configs `.amazonq/agents/*.json` (screener O8 #2) — rejected as a lever:
   the published gate classifies them by their stamped path, so they are already covered;
   verified behaviourally and kept as a functional test (global agent config starts).
6. Precedence merge in `loadMcpServerConfigs` that keeps the global path — rejected: the
   standard config order processes workspace files before the global file, so the
   "existing global" branch is unreachable through `discoverAllServers` (verified: the
   published fix still prompts). Replaced by #7.
7. Legacy-MCP-over-agent-config merge keeping the prior (global) source path — **chosen (T3)**.
   Reachable in the standard order and bypasses the published gate.
8. `reinstallServer` falls back to the global agent path — rejected: only reached from the
   network registry sync; no offline real entry point.
9. `addServer`/`addRegistryServer` take a caller-supplied config path — rejected as a lever:
   the caller is the UI, not the workspace; kept as entry-point tests.
10. `hooks.agentSpawn` / `hooks.userPromptSubmit` declared but never executed — **chosen (T4)**.
    Out of scope in the screener, documented field, far from the MCP gate.
11. Path equality / symlink / URI normalization — rejected: the dangerous direction needs
    writing to `$HOME` (out of scope); the other direction only over-prompts.
12. `updateServer` merge — kept as an identity route (edited saved server), not a separate lever.
    (The legacy-server variant hits a pre-existing null dereference, so the test uses an
    agent-config server.)
13. Registry version sync / reinstall — rejected: network-only.
14. `removeApproval` scope — only over-removal (safe direction), not a lever.
15. Docker container tracking `execSync` — not config-driven.
16. `hooks.userPromptSubmit` execution — same concept as T4; only `agentSpawn` injected.
17. `PATH` override in env resolving `command` to a workspace binary — rejected: the config
    (including env) is approved; the prompt not showing env is a UI-clarity issue, not a
    consent bypass.
18. Migration of workspace config into the global agent file — rejected: verified
    `migrateToAgentConfig` writes workspace servers to the workspace agent path.
19. Multi-root ordering collisions — rejected: each entry stamps its own source file.
20. Name-sanitization collisions — rejected: dedupe plus identity binds the config.
21. Malformed approval store — fails closed by design, no attacker route.
22. Persona enabling a server — rejected: no start without the gate.
23. `useLegacyMcpJson` / global mcp override — rejected: the executed config is the user's own.

Picks and why they beat the rest: T1 and T2 are real how-type gaps that the published fix
leaves open (both were fixed months later upstream), each with a different reason a solver
would dismiss it. T3 is the hardest reachable merge/provenance gap (the first attempted merge
was dead code under the real config order and was replaced after a behavioural check). T4 is a
protection-never-existed route in a different subsystem that the MCP gate never sees.
#3/#4 were dropped for concept overlap; #6/#8/#13 were dropped for reachability.

## Verified

- The exploit reproduces through `McpManager.init` + `discoverAllServers` with a real
  filesystem workspace: the workspace `mcp.json` command runs, zero dialogs (marker written).
- On the injected pinned tree: 12/12 security tests fail, 110/110 functional tests pass (Harbor nop stage PASSED on 2026-10-29).
- After the reference fix: 12/12 security and 110/110 functional pass, including the
  project's own mcpUtils.test.ts (59) and mcpManager.test.ts (44).
- The published upstream fix, applied to the injected tree, fails security tests 02, 03, 04,
  06, 07, 09 and passes all functional tests.
- Every check patch was applied to a clean injected baseline and run: each `security_fail`
  leaves at least one security test failing with functional green; `ff-refuse-all` fails the
  global-config functional tests; `ff-crash` fails the approved-workspace functional tests;
  `pass-hardening` and the differently built `pass-alt-fix` (gate in `initOneServer`, plain
  canonical-string identity, path-annotated hooks) score 1.0.
- Project tests at the pinned+injected commit: 103 passing.
- Static gate: everything green except the intentionally absent `blind` pass patch.

## Could not verify / unknowns

- Harbor gate stages (Docker runs): static green except the pipeline-written blind patch; nop PASSED
  (12/12 security fail, 110/110 functional pass); oracle PASSED (3 identical runs, reward 1.0);
  patches PASSED 11/11 (published fix and four per-lever misses: security_fail with functional green;
  refuse-all: 2 functional fail; crash: 4 functional fail; hardening and alternative: 1.0).
- The advisory body was not supplied, so the exact protected property rests on the summary,
  CWE and the two published commits. I verified the mechanisms behaviourally instead.
- The latest upstream state was read read-only at HEAD (2026-10-28); the task itself is pinned
  to April 2026 and the environment is offline, so no upstream code reaches the solver.
- Whether the benchmark's eventual hidden interest matches the registry-env reading of the
  advisory; this is my reading of the published fingerprint, confirmed as a real later fix.
- An agent could implement consent for workspace hooks by prompting instead of ignoring them;
  the security test denies, so both designs pass, and the global-hook functional test rejects
  prompting for trusted configuration.

## Fairness notes

- The dialog contract (`window.showMessageRequest`, action titles) is stated in the
  instruction because the tests must be able to answer the question.
- The key-order canonicalisation contract is stated because a functional test covers it.
- Registry data is trusted input normally fetched online; the tests seed it directly so the
  suite stays offline. This does not give the attacker a new capability.
- Security tests assert absence of the side effect, never a particular status or error shape.

## Files

`tasks/language-servers-s4/` (instruction, task.toml, environment/, solution/, tests/) and
`build/language-servers-s4/` (manifest.json, checks/*.patch, this file). Register rows were
appended to `build/audit/uncovered-routes.tsv` for T1 and T2.

End (UTC): 2026-10-29T00:52:46Z
