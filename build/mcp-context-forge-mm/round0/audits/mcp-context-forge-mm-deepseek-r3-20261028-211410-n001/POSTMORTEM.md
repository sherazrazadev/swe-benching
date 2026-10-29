# Post-run audit: mcp-context-forge-mm__Wr3vJM7

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.8.

**Trustworthy:** False  **Attribution:** test-fault  **Confidence:** high

Reward 0.8 comes from a single failing security test, test_resource_body_is_not_evaluated. That test asserts the malicious resource CREATE returns HTTP 200 before checking that the READ is refused (tests/security/test_resource_body_isolation.py:8 `assert created.status_code == 200`). The model's fix refuses the unsafe resource body at creation time: the ResourceCreate content validator calls validate_jinja_template, so the request gets a 422. That is exactly what the instruction asks for: "A request that would do so is refused with a client error and leaves no prompt, resource or other state created" (instruction.md:20-21). The model also hardened the read path (_render_resource_text -> render_jinja_template with a sandbox, an AST allow-list and finalize), which covers resource rows that reached the DB another way. So the test failed on its precondition, not on any exposure. The tests also disagree with each other: the prompt security tests explicitly allow a creation-time refusal (test_prompt_render_isolation.py:23 `if created.status_code == 200 else "missing-prompt"`), but the resource test does not. Every other test passed (all 4 other security tests, 9 hidden functional tests, and the project unit suites). No contamination was found and no tool calls happened during grading. A fair grader would very likely have given 1.0.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| security.test_resource_body_isolation::test_resource_body_is_not_evaluated | fail | test-fault | False | False |
| security.test_prompt_render_isolation::test_render_does_not_expose_runtime_objects / test_json_rpc_render_does_not_expose_runtime_objects | pass | genuine-pass | True | True |

**Lookup or leak:** None found. The agent only read and ran the repository's own project tests under /workspace/tests (e.g. tests/unit/..., tests/security/test_input_validation.py). It wrote temporary self-check tests and deleted them (transcript.md:474-516). There is no sign of access to the hidden verifier tests or of fetching an upstream fix. run.json shows tool_calls_during_grading is empty and agent_events_after_end is 0.

**Evidence:**
- evidence/tests/security/test_resource_body_isolation.py:7-10: create must return 200, then the read must be refused
- evidence/instruction.md:19-21: 'A request that would do so is refused with a client error and leaves no prompt, resource or other state created or changed.'
- evidence/instruction.md:22: 'This holds for every template the gateway holds ... however the text reached the gateway.' The model covers the read path too (resource_service.py _render_resource_text -> render_jinja_template).
- evidence/tests/security/test_prompt_render_isolation.py:23,31: prompt tests explicitly tolerate a creation-time refusal; the resource test does not (inconsistent)
- evidence/final-code/changes.patch schemas.py hunks: 'if isinstance(v, str) and "{{" in v: validate_jinja_template(v)' in ResourceCreate/ResourceUpdate content validators
- evidence/transcript.md:594: 'resource rejected: ValidationError 1 validation error for ResourceCreate | content | Value error, Template contains potentially dangerous expressions'
- evidence/solution/fix.patch: the reference only swaps in SandboxedEnvironment and does no creation-time validation for resources, so the test encodes the reference's choice of layer
- evidence/build-notes.md:43-47: T3 is described as rendering on GET /resources/{id}; nothing says creation must succeed
- evidence/grading/results.json: the only failure is the resource test; all other security, hidden functional and 593 project tests pass
- evidence/run.json: tool_calls_during_grading [], exception_info null

**Recommended action:** Fix the test. Accept a refusal at either point in test_resource_body_isolation: if the create returns 4xx, assert no resource was stored and treat that as refused (as the prompt tests already do). Or seed the malicious resource directly into the DB so that only the read path is tested. Then regrade this trial; it would very likely score 1.0. Until then, do not report the 0.8 as a model shortfall.
