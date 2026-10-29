# openharness-s4 — build notes and plan

- Advisory: GHSA-24CW-228Q-3RX9 / CVE-2026-56696 / PYSEC-2026-3880 (hkuds/openharness)
- Track: `injected`. Pattern: B.
- Pinned (vulnerable) commit: `ee0af9a24cb4e91af339410765129080cea6e8a1`
- Published fix: `27bb93b810e9ea8fa4832eab7152eeb3b4a6bffb` (merge commit; its first parent is the
  pinned commit, and the tree diff is exactly 20 lines in `src/openharness/commands/registry.py`
  that mark `/issue` and `/pr_comments` `remote_invocable=False`, `remote_admin_opt_in=True`,
  plus two new tests).
- Build start (UTC): 2026-10-29T11:46:16Z
- Build end (UTC): 2026-10-29T12:22:28Z

## Scoping answer (injected track)

The thing this task decides: **may an unprivileged participant on a remote chat channel cause
text they supplied to end up in the assistant's system prompt?** At the pinned commit the
dispatcher in `ohmo/gateway/runtime.py` allows any registered slash command whose
`remote_invocable` is True (the default). The system prompt is assembled at turn start from
host-side files: `src/openharness/prompts/context.py` (project context) and
`ohmo/prompts.py` + the gateway's own prompt composition (ohmo persona, personal memory and
the injected notes section). The published fix only closes the two project-context commands.

## The one security property (written once, before routes)

> Text supplied by anyone on a remote chat channel must never become part of the assistant's
> system prompt, through any command or feature that channel can reach. A request that would
> cause this is refused with a client-visible error and performs no part of it. This holds for
> content that is saved now and only loaded later, and for every place the assistant reads
> host-side text into its instructions.

This is written over the protected outcome (system-prompt content), not over any route. Every
route and sibling below falls under it literally.

Second property: none. `/context` lets a remote chat read the system prompt (a disclosure
issue), but that is a different protection from this advisory's stored-injection scope, so it
is noted out of scope and not built.

## Levers

### L0 — published sites (stated contract, not counted as a lever)
- `/issue set TITLE :: BODY` and `/pr_comments add FILE[:LINE] :: COMMENT`, registered at
  `src/openharness/commands/registry.py:2479-2480` with the default `remote_invocable=True`.
  Handlers at `registry.py:1345-1394` write `.openharness/issue.md` /
  `.openharness/pr_comments.md`; `src/openharness/prompts/context.py:129-137` loads them into
  the system prompt on every turn.
- Published fix: set both commands local-only (with admin opt-in).

### L1 — real uncovered route, HOW-type: remote personal memory (`/memory add`)
- `src/openharness/commands/registry.py:2334` registers `/memory` with the default
  `remote_invocable=True`. Handler `registry.py:676-757`; the ohmo gateway binds
  `memory_backend=create_memory_command_backend(self._workspace)` at
  `ohmo/gateway/runtime.py:252-254`, so a chat message `/memory add TITLE :: CONTENT` writes a
  markdown entry into `<ohmo workspace>/memory/` and appends it to `MEMORY.md`
  (`ohmo/memory.py:39-108`).
- Producer off the check's path: the gateway builds its base prompt with
  `build_ohmo_system_prompt(...)` at `ohmo/gateway/runtime.py:188` / `:651`; that function
  (`ohmo/prompts.py:27-73` → `ohmo/memory.py:150-176`) reads `MEMORY.md` (first 200 lines) and
  up to five memory files (4000 chars each) verbatim into every ohmo system prompt. The
  command-flag check never calls this producer, and it is a different package from the
  landing point.
- Why a solver dismisses it: personal memory is a first-class documented feature for teaching
  the assistant preferences; it is not "project context"; `RELEASE_NOTES_v0.1.8.md:19-22`
  names only config/auth/provider/model/ship as local-only, so the omission looks deliberate.
- Coupled must-keep-working: memory the host stores locally must still be written and must
  still be loaded into the ohmo prompt.
- Confirmed behaviourally on the pinned tree (see "Verified").

### L2 — injected sibling, HOW-type: gateway-scoped `/focus` (ordering)
- Injected code: a `/focus` slash command in the shared registry (marked
  `remote_invocable=False`, `remote_admin_opt_in=True`, so it *looks* protected) whose registry
  handler writes `.openharness/active_repo_context.md`; plus a gateway-scoped branch in
  `ohmo/gateway/runtime.py::_handle_gateway_scoped_command` (the extension point already used
  for `/provider` and `/model`) backed by `ohmo/gateway/focus_commands.py`.
- The gateway calls `_handle_gateway_scoped_command` **before** it reads
  `remote_invocable` (`ohmo/gateway/runtime.py:263-276`), so the flag on `/focus` is never
  consulted: a remote chat message writes `active_repo_context.md`, which
  `src/openharness/prompts/context.py:131-137` loads into the system prompt next turn.
- Why a solver skips it: the command is already marked local-only, and gateway-scoped
  provider/model handling reads as transport/config plumbing that is "by design" (the screener
  notes the same ordering for provider/model as intentional).
- Coupled must-keep-working: the local `/focus set` handler still writes the file and the
  prompt still carries the Active Repo Context section (including the project's own test for
  it).
- Realistic because it is a normal-looking maintainer addition: a chat-facing shortcut for the
  file autopilot already owns, with the same shape as the two existing gateway-scoped commands.

### L3 — injected sibling, where-type but a second prompt implementation: `/note`
- Injected code: the gateway registers an ohmo-only `/note` command onto the runtime's
  command registry (`ohmo/gateway/runtime.py::_register_ohmo_commands`, analogous to
  `_register_gateway_tools`) with the default remote flags, and
  `ohmo/gateway/runtime.py::_runtime_system_prompt` appends a `# Workspace Notes` section read
  from `<ohmo workspace>/notes.md`.
- Why it is a second implementation: the notes section is composed in the gateway, not in
  `build_runtime_system_prompt` or `build_ohmo_system_prompt`; a fix that only edits those
  producers leaves the gateway section intact.
- Why a solver skips it: the command is registered by the gateway, not in
  `create_default_command_registry`, and notes are the owner's own personalisation text;
  nothing in the shared command table points at it.
- Coupled must-keep-working: a notes file written locally is still loaded into every ohmo
  system prompt.
- Realistic because the gateway already owns ohmo-only concerns (`_register_gateway_tools`,
  session backend, workspace dirs) and adds commands to the shared registry after build.

## Candidate list (every route/sibling found, before choosing)

Real upstream routes to `build_runtime_system_prompt` / `build_ohmo_system_prompt`:
1. `/issue set|clear` (`registry.py:2479`) — published. Keep as L0.
2. `/pr_comments add|clear` (`registry.py:2480`) — published. Keep as L0.
3. `/memory add|remove|edit|migrate` → ohmo personal memory (`registry.py:2334`,
   `ohmo/memory.py`, loaded by `ohmo/prompts.py:66-67`). **Chosen L1**: real, remote, different
   package, producer off the command-flag path; strongest dismissal ("it is a feature").
4. `/dream run|rollback` → memory store (`registry.py:2333`, `ohmo/memory.py:150-176`).
   Rejected: rollback replays an agent-produced backup, and `/dream run` content is
   model-generated from the conversation, so a deterministic "attacker text appears verbatim"
   test is not possible. Noted in the manifest status, not built.
5. `/init` → `CLAUDE.md` and `.openharness/memory/MEMORY.md` (`registry.py:1003-1016`).
   Rejected as an attack: fixed template, only created when absent; no attacker-chosen text.
   Kept as a safe control only.
6. Session-end personalisation hook: `close_runtime` → `update_rules_from_session` →
   `save_local_rules` writes `~/.openharness/local_rules/rules.md`, which
   `build_runtime_system_prompt` injects as "Local Environment Rules" (`prompts/context.py:126`).
   Real, and a genuine producer off every command path, but rejected: only regex-matched
   fragments (URLs, IPs, paths, env-var names) are persisted, the fix has no clean remote/local
   signal at session close, and it sits outside this advisory's project-context scope. Recorded
   as considered.
7. Agent file/shell tools can write `CLAUDE.md` or `.openharness/*` when a remote chat talks
   the assistant into it. Real, but rejected: it is the assistant's core editing capability,
   gated by the permission mode, and any fix that disables it remotely breaks legitimate use.
8. `/output-style`, `/fast`, `/effort`, `/passes` change settings, not prompt text; rejected.
9. `/context` (show) reads the system prompt remotely — different protection (disclosure),
   outside this advisory; noted out of scope.
10. Skill/plugin commands carry disk-authored prompt text, not chat-supplied text; rejected.
11. `/share`, `/export`, `/copy`, `/feedback`, `/tag`, `/session` write non-prompt artefacts;
    rejected.

Injected sibling candidates considered:
- (a) gateway-scoped `/focus` write to `active_repo_context.md` (ordering bypass). **Chosen
  L2** — how-type (the check is skipped for gateway-scoped names), far from the landing point,
  plausible "already marked local-only" dismissal.
- (b) gateway-registered `/note` + gateway-level prompt section. **Chosen L3** — second
  prompt-assembly implementation; registration is not in the shared registry.
- (c) unified `/context add FILE :: TEXT` in the shared registry next to the landing point.
  Rejected: a solver scanning the command table finds it immediately; where-type only and too
  close to the report's example.
- (d) `/soul` / `/profile set` writing `soul.md`/`identity.md`/`user.md`. Rejected: same
  producer as L1 (`build_ohmo_system_prompt`), so it adds no new mechanism and duplicates L1's
  dismissal.
- (e) autopilot context-set handler. Rejected: `/autopilot` is already local-only and any
  gateway-scoped variant is the same mechanism as (a).
- (f) `/remember` alias writing ohmo memory. Rejected: another route of the same concept as L1.

Why the picks beat the others: L1 is the only strong *real* route with a clean producer/check
split; (c)/(e)/(f) are where-type near the report or duplicates; (d) is the same sink and
producer as L1; L2 is the only injected candidate whose bug is an ordering/dispatch property
that survives a flag-only fix; L3 is the only injected candidate that is a second prompt
producer rather than a second writer.

## Sites, routes and input shapes covered by the security tests

- Sites: `registry.py:2479`, `:2480` (published); `:2334` `/memory` (real); injected
  `_handle_gateway_scoped_command` focus branch; injected `_register_ohmo_commands` note
  registration.
- Routes: remote `/issue set`, remote `/pr_comments add`, remote `/memory add`, remote
  `/focus set`, remote `/note add`, plus the same `/issue set` when the chat is bound to a
  managed-group repo (a different write target).
- Shapes: `TITLE :: BODY` with the payload in the title; `FILE[:LINE] :: COMMENT` appending to
  an existing file; `TITLE :: CONTENT`; plain text after the verb; a chat bound to a group
  repo. No encoding/verb/protocol/role variants are treated as separate cases.

## Coupled must-keep-working (functional tests)

1. Local `/issue set` and `/pr_comments add` handlers still write, and
   `build_runtime_system_prompt` still carries the content verbatim (Markdown and code fences
   intact).
2. A large legitimate local context (13,000 chars) is still loaded, truncated at the same
   12,000-character point as today.
3. Local `/memory add` still writes an ohmo memory file and `build_ohmo_system_prompt` still
   loads it.
4. Local `/focus set` still writes `active_repo_context.md` and the shared prompt builder still
   loads it; the project's active-repo-context test still passes.
5. A notes file written on the host is still loaded into the ohmo system prompt by the gateway.
6. Remote plain chat and remote `/help` keep working (positive control against refuse-all).
7. The project's own tests for the affected area (prompts, command flows, registry, gateway,
   ohmo prompts) pass, minus the one gateway test that asserts the now-forbidden remote
   `/memory add` behaviour.

## Verification performed

- Fetched the pinned commit and the fix commit; the fix tree diff is the 20-line registry
  change plus tests (no regression tests exist at the pinned commit).
- Reproduced all of `/issue set`, `/pr_comments add`, `/memory add`, `/focus set` and
  `/note add` end-to-end through `OhmoSessionRuntimePool.stream_message` on the
  pinned+injected tree; each wrote its file and the marker appeared in a freshly built system
  prompt. With the oracle applied all five are refused, no file is written and the prompt is
  clean.
- All 15 check patches were first validated locally (security/functional/project suites), then
  by the gate in Harbor:
  - static PASS (with the final instruction; also written to `static-final.json`)
  - nop PASS: 7/7 security tests fail on the vulnerable copy, all 163 functional/project pass
  - oracle PASS: 3 runs, reward 1.0, identical results
  - patches PASS: every `security_fail` fails only security (functional 0 failing), every
    `functional_fail` fails functional, `hardening` and `alternative` score 1.0. The dedicated
    report is `patches-report.json`; the shared `gate_report.partial.json` holds the final
    static re-check (`static-final.json` holds the same).
- Three local determinism runs under the exact verifier dependency set: 170/170 passed each
  time.
- `git apply --check` confirms `solution/fix.patch` and all `checks/*.patch` apply to the
  injected tree, and both patches apply to a fresh clone of the pinned commit.

## Not verified / guesses

- Whether the published fix intended to leave remote `/issue show` working: it marks the whole
  command local-only. The task follows the published semantics and does not test remote show.
- `present_in_latest` for the uncovered routes is unknown (no later tree inspected).
- `/dream` and the session-end rules extractor are real-looking but were not exercised; they
  are not part of the task.
- The blind patch (`checks/blind.patch`) is written after this build by a fresh agent; it was
  not present here, as the build prompt requires.
- The target-model bar (DeepSeek V4.1 Flash, MiMo-V2.6-Pro each failing all three finished
  attempts) is decided by the later trials; no target model was run in this session.
