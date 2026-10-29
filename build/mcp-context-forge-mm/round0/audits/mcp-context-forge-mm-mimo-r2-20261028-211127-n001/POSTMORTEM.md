# Post-run audit: mcp-context-forge-mm__toLjGh8

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.8.

**Trustworthy:** False  **Attribution:** test-fault  **Confidence:** high

Reward 0.8 comes from a single failing security test, test_resource_body_is_not_evaluated. That test requires creating a resource whose body is '{{ ''.__class__.__mro__[1].__subclasses__ }}' to SUCCEED (assert created.status_code == 200) and only then expects the read to be refused. The model refused this body when the resource was created (422 via a ResourceCreate content validator). The instruction explicitly allows this: a request that would expose runtime objects 'is refused with a client error and leaves no prompt, resource or other state created or changed'. The model also hardened the read path: _render_resource_text validates the body and renders it in a sandboxed environment, and main.py maps TemplateSecurityError to 400. So the read would have been refused as well. The failure therefore tests where the refusal happens, which the instruction never specifies, not whether the fix is secure. The other suites tolerate refusal at creation: the prompt tests fall back to 'missing-prompt' when creation is not 200. That makes the resource test inconsistent with both the instruction and its sibling tests. All other security tests and all functional tests passed. The upstream-supplied-template test passed, and it bypasses the creation schema, so it shows that render-time protection really works. There is no sign of contamination. The model's fix looks complete, so the correct score would be 1.0.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| security.test_resource_body_isolation::test_resource_body_is_not_evaluated | fail | test-fault | False | False |
| security.test_prompt_render_isolation::test_render_does_not_expose_runtime_objects / test_json_rpc_render_does_not_expose_runtime_objects | pass | genuine-pass | True | True |

**Lookup or leak:** None found. The agent only read the repository's own tests (/workspace/tests/security/test_input_validation.py, test_rpc_api.py and others; transcript.md:62-176, 466-624). It did not read the hidden suite (evidence/tests). The transcript shows no web lookup of the upstream fix. No netguard.log was provided. run.json shows no tool calls during the grading window ('tool_calls_during_grading': []).

**Evidence:**
- evidence/tests/security/test_resource_body_isolation.py:7-10 - create_text_resource(...) then 'assert created.status_code == 200' before assert_refused(read)
- evidence/instruction.md:19-21 - 'A request that would do so is refused with a client error and leaves no prompt, resource or other state created or changed.'
- evidence/tests/security/test_prompt_render_isolation.py:23 - prompt tests tolerate creation refusal: "name = ... if created.status_code == 200 else 'missing-prompt'"
- evidence/final-code/changes.patch:1618-1624 - ResourceCreate content validator calls validate_stored_template and raises ValueError (refusal at creation)
- evidence/final-code/changes.patch:110-118, 133-138 - read-time validation plus hardened sandbox in _render_resource_text
- evidence/final-code/changes.patch:1532-1534 - main.py maps TemplateSecurityError on resource read to HTTP 400
- evidence/transcript.md:564 - model's own check: 'POST http://testserver/resources/ "HTTP/1.1 422 Unprocessable Entity"'
- evidence/solution/fix.patch:149-153 - the reference fix only swaps in SandboxedEnvironment and adds no creation-time check, so it passes only because creation is accepted
- evidence/grading/results.json:6 - the only failing test; all other security and functional tests pass
- evidence/run.json:18-19 - no agent events or tool calls during the grading window

**Recommended action:** Do not count this trial as a partial failure. Fix the test: accept refusal at creation, as the prompt tests do. For example: if created.status_code != 200, assert 400 <= status < 500, assert no runtime marker, and check that no resource was stored; otherwise assert the read is refused. Then regrade. On the evidence here, the model's fix would score 1.0.
