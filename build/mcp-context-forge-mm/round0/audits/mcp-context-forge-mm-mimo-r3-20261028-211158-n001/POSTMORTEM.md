# Post-run audit: mcp-context-forge-mm__WXcRh6V

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.8.

**Trustworthy:** False  **Attribution:** test-fault  **Confidence:** medium

Reward 0.8 = 4/5 security tests passed and all functional tests passed. The one failure, test_resource_body_is_not_evaluated, needs the gateway to ACCEPT the malicious resource body at creation (`assert created.status_code == 200`) and refuse it only when it is read. The model refused unsafe template text at creation time instead: the ResourceCreate content validator now calls SecurityValidator.validate_template_safety, so the request gets a 422 and the test fails on its first assertion before any read happens. The instruction allows this, and arguably prefers it: a refusal 'leaves no prompt, resource or other state created or changed'. Nothing in the instruction says unsafe content must be stored first. The suite is also inconsistent with itself. The prompt security tests explicitly tolerate a create-time refusal (`name = ... if created.status_code == 200 else "missing-prompt"`, after which a 404 counts as a pass), but the resource test does not. The model's fix is broad: a hardened sandbox with globals cleared and getattr/getitem blocked, an AST safety check, a guard on the str.format fallback, render-time checks in the prompt, resource and import-preview code, and JSON-RPC error mapping. No contamination was found. The 0.8 therefore understates the model's work because the test demands one specific enforcement layer. One open question: the evidence can't show whether the REST GET /resources/{id} handler would have turned a render-time ResourceValidationError into a 4xx if creation had succeeded. Confidence is medium, not high, for that reason.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| security.test_resource_body_isolation::test_resource_body_is_not_evaluated | fail | test-fault | False | False |
| security.test_prompt_render_isolation::test_render_does_not_expose_runtime_objects / test_json_rpc_render_does_not_expose_runtime_objects | pass | genuine-pass | True | True |

**Lookup or leak:** None found. The agent read only the repository's own unit tests under /workspace/tests/unit (for example transcript.md:25-29, 451-466). It never touched the hidden verifier tests (tests/security, tests/functional). The transcript shows no fetches from code hosts or package registries and no upstream advisory or fix being looked up. The fix is original: a custom AST checker and hardened SandboxedEnvironment, structurally different from the reference fix.patch.

**Evidence:**
- evidence/grading/results.json:6 — only failing test: security.test_resource_body_isolation::test_resource_body_is_not_evaluated; all functional tests pass
- evidence/tests/security/test_resource_body_isolation.py:7-8 — create_text_resource(...); `assert created.status_code == 200, created.text` (requires the unsafe body to be stored)
- evidence/tests/security/test_prompt_render_isolation.py:23 — `name = created.json().get("name") if created.status_code == 200 else "missing-prompt"` (prompt tests accept a create-time refusal)
- evidence/instruction.md:20-21 — 'A request that would do so is refused with a client error and leaves no prompt, resource or other state created or changed.'
- evidence/final-code/changes.patch:1304-1306,1340-1341 — schemas.py resource content validators call SecurityValidator.validate_template_safety(text)
- evidence/final-code/changes.patch:1155-1156 — register_resource calls self._validate_resource_templates(resource) before storing
- evidence/final-code/changes.patch:1111-1122 — _render_resource_text also refuses at read time (ResourceValidationError) and uses the hardened sandbox
- evidence/transcript.md:422 — agent checks '# unsafe refused (422 path at REST)' for ResourceCreate with content '{{ lipsum }}'
- evidence/solution/fix.patch:149-153 — the reference fix only swaps in SandboxedEnvironment for resources and does no create-time validation, so the test encodes the reference fix's choice of layer
- evidence/build-notes.md:43-47 — T3 is described only as render-time sandboxing; nothing considers that a fix might refuse the body at creation
- evidence/run.json timing — tool_calls_during_grading: [], agent_events_after_end: 0 (no edits during grading)
- evidence/grading/test-stdout.tail.txt is empty, so there is no captured assertion message. The failure point is inferred from the patch plus the test structure.

**Recommended action:** Count this trial as test-fault, not model-failed. Change test_resource_body_isolation to accept a create-time refusal the same way the prompt tests do: if creation returns 4xx and the body has no runtime marker, pass; if it returns 200, require the read to be refused. Then regrade this trial. A regrade with the corrected test would probably give 1.0, assuming the REST read path also maps ResourceValidationError to 4xx, which should be checked during the regrade. Separately, add a resource body that skips schema validation (for example, inserted directly or from upstream federation) so the read-time sandbox is still tested.
