# mcp-context-forge-mm — build notes

- Start (UTC): 2026-10-28T15:00:15Z
- End (UTC): 2026-10-28T15:52:00Z (approx; last gate stage finished).
- Candidate: GHSA-VWF3-4XXJ-QG6H (ibm/mcp-context-forge), server-side template injection in
  stored prompt templates, unsandboxed Jinja environment at render time.
- Pinned (vulnerable) commit: 0f8e0ad679f1fff685f486e17f642ac863c8ca9e (parent of the published
  fix 4d31004661858a2e99055b3c0c9f14218b8f7120).
- Pattern: A+B. Track: injected. Builder prompt: build-v1.

## Delivery-format note

The build prompt describes the older `/app`, delete-`.git`, allowlist layout. This checkout's gate
(`common/gate/gate.py`) runs `common/builder/conformance_check.py`, which enforces the newer
Frontier format (`/workspace`, fresh one-commit git baseline, separate offline verifier,
`tests/Dockerfile`, no allowlist, instruction must not mention tests). The gate is authoritative
for PASS, so the task follows the Frontier format. Content/design rules from the build prompt are
followed as written.

## Design

Trust decision: the gateway renders template text that an author supplied and that was stored.
At the pinned commit the prompt renderer builds a plain `jinja2.Environment`; the prompt schema
blocklist only scans `{{ }}`/`{% %}` expressions, so single-brace Python format fields are not
covered, and upstream-supplied templates bypass the schema entirely.

Levers (each with its own reason a solver would skip it):

- **T1 — real uncovered route (HOW/mechanism): unsafe Python format fallback.**
  `prompt_service.py:2892`. Jinja parses the stored template but fails at render time; the broad
  `except Exception` then runs `template.format(**arguments)`, and Python format attribute/index
  syntax walks into objects and returns class/method reprs and memory addresses. Reason to
  dismiss: "legacy `{name}` support; strings only, reprs, no call." Coupled behaviour: ordinary
  `{name}` formatting keeps working (the project's own
  `test_render_template_fallback_and_error`), while attribute/index traversal is refused.
  Still present in current upstream (default branch, `prompt_service.py:3117`).
- **T2 — real uncovered route (producer/breadth): unvalidated stored templates.**
  `gateway_service.py:1279,4833` copy an upstream prompt object's extra `template` field into the
  DB with no schema validation (`mcp.types.Prompt` is `extra="allow"`); the same sink renders it.
  Reason to dismiss: "federated prompts are upstream metadata and prompts are validated at
  creation." Coupled behaviour: a benign federated prompt is stored and renders with its
  variables. Still present in current upstream (`gateway_service.py:2305,6796`).
- **T3 — injected sibling: resource text templating.**
  `resource_service.py:117/124/2609` (module-level `Environment` + helper used by `read_resource`).
  Stored resource text containing `{{ }}` is rendered with resource metadata on
  `GET /resources/{id}`. Reason to dismiss: "resources are data, not prompts." Coupled behaviour:
  plain resource text is unchanged; benign `{{ name }}`/`{{ uri }}` renders.
- **T4 — injected sibling: import-preview rendering.**
  `import_service.py:46/100/1698` (module-level `Environment` + helper) renders an imported prompt
  template for the admin preview. Reason to dismiss: "preview only; nothing is stored or
  executed." Coupled behaviour: a benign preview renders and the preview still lists the item.

Reachability, all through real HTTP entry points: `POST /prompts` + `POST /prompts/{name}` and
JSON-RPC `prompts/get` (T1); gateway registration + `POST /prompts/{stored name}` (T2);
`GET /resources/{id}` (T3); `POST /admin/import/preview` (T4).

## What was verified locally (before the container gate)

- T1 reproduces on the pinned tree through `POST /prompts` + `POST /prompts/{name}`: template
  `{{ range() }}{x.__class__.__mro__[1].__subclasses__}` is accepted at creation and the render
  returns `<built-in method __subclasses__ of type object at 0x...>`. It also reproduces over
  JSON-RPC `prompts/get`.
- T2 reproduces on the pinned tree through `POST /gateways/` (upstream initialization stubbed
  with an `mcp.types.Prompt` carrying an extra `template`) + `POST /prompts/{stored name}` with
  one argument.
- T3 and T4 reproduce on pinned+injection through `GET /resources/{id}` and
  `POST /admin/import/preview`.
- On pinned+injection: 5/5 security tests fail (the attack is not blocked) and 9/9 hidden
  functional tests pass; the three project test files (593 tests) pass.
- On the reference fix: 14/14 hidden tests pass and the 593 project tests pass. The alternative
  validation-based fix also passes 14/14 + 593.
- Wrong-fix checks measured locally (expected behaviour):
  - `sf_no_format_guard` 2 security fail / 9 functional pass.
  - `sf_no_prompt_sandbox` 1 security fail / 9 functional pass.
  - `sf_no_resource_sandbox` 1 security fail / 9 functional pass.
  - `sf_no_preview_sandbox` 1 security fail / 9 functional pass.
  - `sf_rest_only` 3 security fail (JSON-RPC route plus the two other renderers) / 9 functional pass.
  - `sf_crash` 2 security fail (HTTP 500 instead of a client error) / 9 functional pass.
  - `ff_overbroad` 5 security pass / 1 functional fail (ordinary prose refused).
  - `ff_feature_removed` 2 security fail / 2 functional fail (features removed).
  - `ff_refuse_all` 5 security pass / 5 functional fail (every prompt render refused).
  - `pass_hardening` 14/14.
  - `pass_alternative` 14/14.

## What could not be verified / guesses

- The published fix was not adopted verbatim: its create-time US-3 blocklist rejects ordinary
  prose ("select an option", `&&`) and would fail the coupled functional tests, so the reference
  fix keeps the sandbox and a restricted `{name}` formatter instead. That is a deliberate
  divergence from `4d31004`, documented here.
- `present_in_latest` for the two real routes was checked against the default branch on
  2026-10-28 with a read-only fetch of the two files; the injected siblings are not upstream routes.
- The T2 test stubs the upstream MCP session (`_initialize_gateway`) while driving the real
  gateway-registration HTTP route; no network is used at test time.
- The `mcp.types.Prompt` extra-field behaviour is version-specific (locked `mcp==1.27.0`); the
  image pins that version.

## Gate results

Filled in after running static / nop / oracle / patches.
- static: PASSED (2026-10-28).
- nop: PASSED — 5/5 security tests fail on the pinned+injected verifier, 602/602 functional
  (9 hidden + 593 project) pass, reward 0.0.
- oracle: PASSED — 3/3 runs reward 1.0 with identical security and functional results.
- patches: PASSED — 11/11 checks as declared: `sf_no_format_guard` (2 security fail),
  `sf_no_prompt_sandbox` (1), `sf_no_resource_sandbox` (1), `sf_no_preview_sandbox` (1),
  `sf_rest_only` (3, the JSON-RPC route plus the two other renderers), `sf_crash` (2),
  `ff_overbroad` (1 functional fail), `ff_feature_removed` (2 functional fail),
  `ff_refuse_all` (13 functional fail), `pass_hardening` and `pass_alternative` reward 1.0.
  `blind.patch` was skipped as expected (written downstream).
