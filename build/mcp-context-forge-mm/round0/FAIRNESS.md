# FAIRNESS — mcp-context-forge-mm

Covering properties (from `instruction.md`), quoted: **P1** "No template text that the gateway
renders may evaluate or expose the gateway's Python objects, classes, modules, attributes or memory
addresses. A request that would do so is refused with a client error and leaves no prompt, resource
or other state created or changed." **P2** "This holds for every template the gateway holds and
every rendered response, however the text reached the gateway." **P3** "Legitimate template use
keeps working exactly as today: plain text, variables, loops, filters and conditionals, and the
single-brace `{name}` substitution that existing prompts rely on." **P4** "Ordinary prose is not
template code… must be accepted and returned unchanged." **R1** "A refusal is a client error
(HTTP 4xx) with no side effect. For a JSON-RPC request the refusal is an `error` member…"
**R3** "A rendered prompt is returned as the text of the message content; a resource body is
returned in the response's `text` field."

## 1. Test-by-test fairness

| Test (file::name) | What it asserts | Covering sentence | Could a correct fix fail it? | Risk |
|---|---|---|---|---|
| security/test_prompt_render_isolation.py::test_render_does_not_expose_runtime_objects | Create `{{ range() }}{x.__class__.__mro__[1].__subclasses__}`, POST /prompts/{name} → 4xx, body lacks `of type object at 0x` | P1 + R1 (the render request is refused 4xx) | no — sandbox + guarded `{name}` fallback refuses; an even earlier creation refusal is tolerated by the harness | low |
| security/test_prompt_render_isolation.py::test_json_rpc_render_does_not_expose_runtime_objects | Same payload over POST /rpc `prompts/get` → `error` member, no marker | P1 + R1 (JSON-RPC error member) | no | low |
| security/test_unvalidated_template_source.py::test_upstream_supplied_template_is_not_evaluated | Gateway registration 200; the upstream prompt is stored and listed; rendering it → 4xx | P2 ("however the text reached the gateway") | maybe — only a fix that *also* refuses or drops the unsafe template at storage fails the 200/listing assertions; the primary render-time fix passes | medium |
| security/test_resource_body_isolation.py::test_resource_body_is_not_evaluated | POST /resources/ → 200; GET /resources/{id} → 4xx, no marker | P1 ("template text that the gateway renders"), P2, R3 | maybe — a fix that validates the body at creation (4xx, nothing stored) satisfies P1's refusal clause yet fails `assert created.status_code == 200`; the primary render-time fix passes | medium |
| security/test_import_preview_isolation.py::test_import_preview_does_not_evaluate_template | POST /admin/import/preview with an unsafe template → 4xx | P2 ("every rendered response, however the text reached the gateway"), P1 | maybe — a fix that omits the unsafe preview and returns 200 exposes nothing but is not a refusal; the natural refusal passes | medium |
| functional/test_prompt_features.py::test_plain_variable_renders | `Hello {{ name }}` → `Hello World`, 200 | P3 ("variables") | no | low |
| functional/test_prompt_features.py::test_loop_filter_and_condition_render | loop + filter + conditional renders exactly | P3 ("loops, filters and conditionals"); P4 ("one variable, a three-iteration loop and one filter… must render") | no | low |
| functional/test_prompt_features.py::test_ordinary_prose_is_accepted_and_returned | `select…&&` prose accepted and unchanged | P4, literally | no | low |
| functional/test_prompt_features.py::test_literal_braces_are_preserved | `Use { and } for JSON: {{ name }}` created 200 and renders `Use { and } for JSON: X` | P4 ("Ordinary prose is not template code… returned unchanged") | maybe — a fix that validates every single-brace field at authoring/argument-derivation returns 4xx or 422; the natural fix never reaches the fallback and passes | medium |
| functional/test_prompt_features.py::test_upstream_prompt_still_renders | benign federated prompt stores and renders | P2 + P3 | no | low |
| functional/test_resource_and_preview_features.py::test_plain_resource_body_is_returned_unchanged | body returned verbatim in `text` | P3 ("plain text"), R3 | no | low |
| functional/test_resource_and_preview_features.py::test_resource_body_placeholders_expand | `{{ name }}`/`{{ uri }}` expand | P3 ("variables"), R3 | no | low |
| functional/test_resource_and_preview_features.py::test_import_preview_renders_a_benign_template | 200, one item, `Hello <name>` | P3 | no | low |
| functional/test_resource_and_preview_features.py::test_import_preview_lists_the_imported_item | preview lists the item | standard expert knowledge: existing listing behaviour is not the flaw and must not be removed | no | low |
| project tests/unit/…/test_prompt_service.py::TestPromptService::test_render_template_fallback_and_error | forced render failure falls back to `{name}` substitution; missing arg → PromptError | P3 ("the single-brace `{name}` substitution that existing prompts rely on") | maybe — a fix that deletes the fallback fails, but P3 requires keeping it; a fix that bypasses `_compile_jinja_template` loses the mock | low |
| project tests/unit/…/test_prompt_service.py::TestJinjaTemplateCaching::test_format_fallback_still_works | same fallback contract | P3 | no | low |
| remaining 591 project tests | current service behaviour | standard expert knowledge: no regression; oracle and alternative both pass all 593 | no | low |

No `yes` exists: a natural render-time fix (sandbox every template environment, stop passing a
failed render to Python `format()`, allow only plain `{name}` fields, keep raising the existing
`PromptError`/`ResourceError`/`ImportValidationError` → 4xx) passes every test above; oracle 3/3 and
`pass_alternative` confirm this. The "maybe" rows are the same alternative — refusing *earlier* at
authoring/registration — which the instruction permits but does not state as the mechanism.

## 2. Leniency (quality)

Plausible wrong fix per trap, and whether a test catches it:

- **T1 format fallback**: keep `template.format(**arguments)` after sandboxing Jinja → caught by
  both `test_prompt_render_isolation` tests (`sf_no_format_guard`, 2 security fails). Route-only
  shallow guard in `main.get_prompt` → caught by the JSON-RPC test and the two sibling tests
  (`sf_rest_only`). Crash instead of a client error → caught only for resource/preview
  (`sf_crash`); a `RuntimeError` in the prompt path would also fail the two prompt tests (they
  demand 4xx).
- **T2 unvalidated stored template**: sandbox only authoring-validated prompts, leaving federated
  prompts trusted → caught by `test_upstream_supplied_template_is_not_evaluated`
  (`sf_no_prompt_sandbox`).
- **T3 injected resource body**: delete resource-body rendering as "data" → caught by
  `test_resource_body_placeholders_expand` and the plain-body test (`ff_feature_removed`); sandbox
  prompts only → caught by `test_resource_body_is_not_evaluated` (`sf_no_resource_sandbox`).
- **T4 injected import preview**: remove the preview → caught by
  `test_import_preview_renders_a_benign_template` (`ff_feature_removed`); sandbox prompts/resources
  only → caught by `test_import_preview_does_not_evaluate_template` (`sf_no_preview_sandbox`).

**Wrong fixes no test catches:**

1. A pure token blocklist — `if "__" in template: refuse` (or a `__class__`/`__subclasses__`
   substring check) at the four render sites, with **no sandbox at all** — passes all 5 security
   and all 602 functional/project tests, since every payload contains a literal `__`. It is
   bypassed by `{{ ''|attr('_'~'_class_'~'_')|attr('_'~'_mro_'~'_')|last|attr('_'~'_subclasses_'~'_')() }}`.
2. A fix that only rejects dotted/index field names when the argument is *undeclared*: T1 supplies
   an undeclared dotted key, so a fix that filters render arguments to declared names passes while
   `{name.__class__…}` starting from a legitimate string argument still traverses.
3. Nothing asserts the "no side effect" clause; a refusal that has already created or changed state
   passes.
4. A fix that refuses only on the exact demonstrated gadget (`range()`, `__subclasses__`) passes.

## 3. Hints (quality)

- "the single-brace `{name}` substitution that existing prompts rely on" — names the fallback
  mechanism T1 exploits. → "any placeholder syntax that existing prompts already rely on".
- "words such as 'select', or symbols such as '&&'" — lifted from the overbroad-check blocklist.
  → "ordinary words or symbols that look like code".
- "A template with one variable, a three-iteration loop and one filter is ordinary and must render."
  — exact recipe of `test_loop_filter_and_condition_render`. → "variables, loops, filters and
  conditionals must keep rendering".
- "including memory addresses" — names the marker the tests look for. → "may expose the gateway's
  own runtime objects and classes".
- "For a JSON-RPC request the refusal is an `error` member…" — names the channel that
  `sf_rest_only` targets. → "a refusal is a client error, or the protocol's error member, with no
  side effect".

### 3a. Required: generalize

- "The same is possible for other template text the gateway stores and renders." — enumerates the
  sibling sites (resources, preview) in product terms and exists only to cover them. Delete it; P2
  already says "every template the gateway holds and every rendered response, however the text
  reached the gateway."
- "A rendered prompt is returned as the text of the message content; a resource body is returned in
  the response's `text` field." — names the resource object kind and its output format, i.e. where
  T3 lives. → "Rendered output is returned in the response field the current API already uses for
  that output."
- "Clients can create prompts and resources, list them, and ask the gateway to render a prompt with
  arguments or to return a resource's body." — product-term enumeration of the graded routes.
  → "Clients author and retrieve stored content over the gateway's HTTP and JSON-RPC API."

## 4. Realism (quality)

T1 (`prompt_service.py:2892`, the `format()` fallback after a render failure) and T2
(`gateway_service.py:1279/4833`, upstream prompt extras stored without the authoring schema) are
real, unmodified upstream code reached through the real HTTP routes — realistic by definition; no
"beyond the advisory" objection applies. T3 and T4 are injected, but both are maintainer-plausible
extensions of the existing services (metadata interpolation for text resources; an admin preview
that renders imported templates) using the same module-level environment idiom as the real code
and reached through real routes. The T1 payload merely relies on `range()` raising `TypeError` to
reach the fallback, which is an ordinary render failure, not a planted gadget. No contrived trap
found. Note: `pass_hardening` legitimately passes because the sandbox remains primary; the danger
is that a blocklist-alone solution also passes (see §2).

## 5. Verdict

**GATE A: READY.** The primary stated mechanism is render-time refusal of text that would expose
runtime objects, with legitimate templating intact. The natural fix passes all 14 hidden tests and
the 593 project tests (oracle 3/3, `pass_alternative`). No test requires a particular internals
gadget, error class or status beyond the instruction's stated 4xx, and no uncovered/injected route
escapes the literal general property (P1/P2 cover all four sinks). The three "maybe" rows reflect
only an alternative implementation that refuses *earlier* (at authoring or registration); that is
not the stated mechanism and does not make the task unfair under the primary-mechanism rule — it is
recorded below and as a human-review point.

**Required: generalize** — see §3a (three sentences).

**Quality to tighten** — (i) add an obfuscated-gadget test at prompt, resource and preview to kill
token blocklists (`__`-free construction); (ii) add a fallback case whose traversal starts from a
declared string argument; (iii) let the resource-security test accept a 4xx at creation (and the
federation test accept a refused/dropped prompt) so an earlier-layer fix is not failed; (iv) add a
"no side effect" check; (v) neutralize the hint wording in §3.

**Human review**: confirm that pinning creation→200 (`test_resource_body_is_not_evaluated`) and
registration→200 / stored-prompt-present (`test_unvalidated_template_source`) is intended, since a
fix that additionally refuses unsafe text at authoring is safe yet fails those assertions.

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
