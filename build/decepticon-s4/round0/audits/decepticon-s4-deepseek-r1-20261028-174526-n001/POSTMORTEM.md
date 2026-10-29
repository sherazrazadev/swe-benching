# Post-run audit: decepticon-s4__rcndgV6

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.7195.

**Trustworthy:** False  **Attribution:** test-fault  **Confidence:** medium

Reward 0.7195 = 59/82 security tests passed, with all 249 functional tests passing. There are 23 security failures. 17 of them (7 KG summary, 10 completion notification) fail because the tests check the intermediate output of KGMiddleware.wrap_model_call and SandboxNotificationMiddleware.before_model. The model deliberately left those producers alone. Instead it made literals inert at the model boundary: a new innermost ChatTemplateSanitizerMiddleware is appended last in build_middleware, both quarantine middlewares neutralize the whole ModelRequest, and the LLM factory's _get_request_payload neutralizes the outbound wire payload. That design plausibly satisfies the stated property ('must be made inert before the model sees it') for the KG and notification paths, but the tests only accept a fix at the producer layer, which the instruction never names. The other 6 failures are mixed-width tokens ('<|im_start\uff5c>', '<\uff5cim_end|>'). The model's regex requires matching pipe widths on both sides. The instruction defines a control literal by what a tokenizer parses as a structural token, and no known tokenizer has these mixed forms as special tokens; only the 'close variants' clause supports them. Those 6 failures are a defensible but debatable shortfall. Because most of the lost reward comes from tests that demand a specific layer, the reward understates the model's work and should not be trusted as a measure of it. There is no contamination or infrastructure problem.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| security.test_kg_summary_special_tokens::test_summary_label_cannot_carry_a_control_literal[*] (5 params), ::test_summary_literal_is_defanged_without_an_existing_system_message, ::test_entrypoint_label_cannot_carry_a_control_literal | fail | test-fault | False | False |
| security.test_notification_special_tokens::test_completion_output_cannot_carry_a_control_literal[*] (7 params), ::test_ansi_wrapped_literal_is_defanged, ::test_two_completed_sessions_cannot_each_carry_a_literal, ::test_async_completion_output_cannot_carry_a_control_literal | fail | test-fault | False | False |
| security.test_{command_tool_output,envelope_special_tokens,shield_body_special_tokens}::*[<|im_start\uff5c>] and *[<\uff5cim_end|>] (6 tests) | fail | instruction-ambiguity | False | False |

**Lookup or leak:** None found. The transcript shows the agent reading only the repository's own tests under /workspace/packages/*/tests and /workspace/tests (e.g. transcript.md:23-28, 95-127), running the project test suite, and writing its own regression test. There was no network fetch, package install or upstream lookup. run.json shows 0 agent events after the agent ended and no tool calls during grading.

**Evidence:**
- evidence/grading/results.json: reward 0.7195; failures are exactly 7 KG + 10 notification + 6 mixed-width; all 249 functional tests pass
- evidence/instruction.md:21-28 'Wherever such content is composed into a model-visible message, every such literal must be made inert before the model sees it' (no layer is named)
- evidence/tests/security/test_kg_summary_special_tokens.py:44-49 calls middleware.wrap_model_call(..., lambda request: request) and asserts on the KG layer's own system_message
- evidence/tests/security/test_notification_special_tokens.py:26-36 asserts on before_model's returned state update, not on the model request
- evidence/final-code/changes.patch:391-421 appends ChatTemplateSanitizerMiddleware innermost in build_middleware (only when a quarantine slot is active)
- evidence/final-code/changes.patch:344-361 neutralize_payload in the LLM client's _get_request_payload ('final model-visible boundary')
- evidence/final-code/changes.patch:894-906 regex arms '<\|[^\s|<>]{1,64}\|>' and '<\uff5c[^\s\uff5c<>]{1,64}\uff5c>' require matching widths
- evidence/solution/fix.patch:29-37 reference regex '< [|\uff5c] ... [|\uff5c] >' with width mixing allowed; the reference neutralizes at kg.py:166 and notifications.py:_format_output
- evidence/tests/support/helpers.py:85 FULLWIDTH includes the mixed '<|im_start\uff5c>' and '<\uff5cim_end|>'
- evidence/build-notes.md:120-121 the alternative pass that was validated still fixes at a reminder composition point; no model-boundary-only alternative was validated
- evidence/transcript.md:139,412 the model explicitly reasoned about KG/notification paths and chose an innermost model-call guard
- evidence/grading/test-stdout.tail.txt is empty, but results.json is complete (331 tests), so no infrastructure loss

**Recommended action:** Do not report 0.7195 as the model's security score. Either (a) add a model-boundary variant of the T4/T5 tests: build the real middleware stack via build_middleware and assert on the request the final handler receives, so producer-level and boundary-level fixes are both accepted, then regrade; or (b) state in the instruction that literals must be neutralized where the reminder/summary is composed (in stored state too). Separately, decide whether mixed-width pipe forms belong in scope. If they do, name full/half-width mixing as a required variant in the instruction, since no tokenizer parses them as special tokens. Unknowns to resolve when regrading: whether every production model client inherits the patched _get_request_payload, and whether every role's stack keeps a quarantine slot so the innermost sanitizer is always installed.
