# Post-run audit: mcp-context-forge-mm__T6pqpj2

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.8.

**Trustworthy:** False  **Attribution:** test-fault  **Confidence:** high

Reward 0.8 comes from one security failure: test_resource_body_is_not_evaluated. All 9 hidden functional tests and 593 project tests passed, as did the other 4 security tests. The failing test asserts that creating a resource whose body is the SSTI payload returns HTTP 200 (tests/security/test_resource_body_isolation.py:8), and only then checks that reading it is refused. The model refused the unsafe body at creation time instead: resource_service.register_resource calls _validate_resource_text_template, which raises ResourceError, and the existing main.py create handler maps that to a 4xx. The instruction explicitly allows this: 'A request that would do so is refused with a client error and leaves no prompt, resource or other state created or changed' (instruction.md:19-20). The model also hardened the read path. Its own regression test inserts an unsafe body directly into the DB and gets 422 on GET /resources/{id} with no runtime leak, so it would also pass the read-time check the test meant to make. The sibling prompt tests tolerate refusal at creation ('if created.status_code == 200 else "missing-prompt"', test_prompt_render_isolation.py:23), but the resource test does not. The failure therefore reflects the test hard-coding the reference's store-then-refuse-on-read design, not a security shortfall. A fair grader would very likely have given 1.0. No contamination was found.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| security.test_resource_body_isolation::test_resource_body_is_not_evaluated | fail | test-fault | False | False |

**Lookup or leak:** None found. The transcript shows only local repo exploration (grep and sed on /workspace), edits, and local pytest runs on the project's own tests and on tests the model wrote. There was no access to /logs/verifier or hidden test files, and no network fetch of upstream code. run.json shows no tool calls during the grading window (tool_calls_during_grading: []).

**Evidence:**
- evidence/grading/results.json:6 - the only failing test is security.test_resource_body_isolation::test_resource_body_is_not_evaluated; all functional tests pass; reward 0.8 = 4/5 security
- evidence/tests/security/test_resource_body_isolation.py:7-8 - create_text_resource(... SSTI payload ...); assert created.status_code == 200
- evidence/instruction.md:19-20 - 'A request that would do so is refused with a client error and leaves no prompt, resource or other state created or changed.'
- evidence/instruction.md:22-23 - 'This holds for every template the gateway holds ... however the text reached the gateway' (read-time defence is also required, and the model provides it)
- evidence/tests/security/test_prompt_render_isolation.py:23 - the prompt tests accept refusal at creation ('if created.status_code == 200 else "missing-prompt"'); the resource test is inconsistent with them
- evidence/final-code/changes.patch:432-463,473-475 - _validate_resource_text_template is called in register_resource before any state is created
- evidence/final-code/changes.patch:1166-1172 - REST read maps ResourceError to 422; changes.patch:1190-1193 - JSON-RPC resources/read returns an error member
- evidence/final-code/changes.patch:1297-1309 - the model's test_create_resource_refuses_ssti_body expects 400 and checks that the resource is absent from the listing; changes.patch:1349-1357 - stored unsafe body refused on read with 422 and no '0x'
- evidence/transcript.md:89 - original main.py already has 'except ResourceError' in the create handler (line 5832), so the create-time refusal is a 4xx
- evidence/transcript.md:594 - TestTemplateSandboxEndpoints: 12 passed
- evidence/solution/fix.patch:131-154 - the reference only swaps in SandboxedEnvironment for resources (no create-time validation), which is why the test assumes creation succeeds
- evidence/run.json:12-20 - agent ended before the grading window; no tool calls during grading

**Recommended action:** Count this trial as a likely full solve (effective reward 1.0) or rerun it with a corrected test. Fix test_resource_body_isolation.py so that refusing the request at creation with a 4xx and no stored resource also counts as a pass. One option: if creation returns 4xx, assert that no runtime marker appears and that the resource is absent from GET /resources/. Another: seed the unsafe body through a path that bypasses create-time validation (for example a direct DB insert or import) so read-time refusal is tested separately. Re-audit other trials of this task that failed only this test.
