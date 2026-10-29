# Post-run audit: decepticon-s4__3vG5W5M

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.7195.

**Trustworthy:** False  **Attribution:** instruction-ambiguity  **Confidence:** medium

Reward 0.7195 = 59/82 security tests passed with all 249 functional tests passing (score.py threshold rule). There are 23 security failures in two groups. (a) 6 failures come from the mixed-width forms '<|im_start\uff5c>' and '<\uff5cim_end|>' across the command, envelope and shield suites. The model's neutralizer is an exact-literal catalog that covers the all-ASCII and all-fullwidth forms but not mixed forms. The instruction asks the agent to 'Fix the problem and its close variants', and NFKC folds U+FF5C to '|'. These are genuine model failures. (b) 17 failures are in the KG-summary suite (7) and the notification suite (10). These tests call KGMiddleware.wrap_model_call with an identity handler, or SandboxNotificationMiddleware.before_model, directly, and they inspect that one hook's output. The model chose not to neutralize at those composition sites. Instead it neutralized the whole request in UntrustedOutputMiddleware/PromptInjectionShield wrap_model_call and appended a new innermost ChatTemplateGuardMiddleware in build_middleware. That guard neutralizes the system message and every message immediately before the main model call. In the real stack this plausibly makes the KG summary and the completion reminder inert before the main model reads them. The hidden tests cannot observe that, because they isolate one layer. The guard has real coverage gaps: it is installed only for roles that have the UNTRUSTED_OUTPUT or PROMPT_INJECTION_SHIELD slot, the raw reminder stays in persisted state, and LLM calls outside the wrap_model_call chain (for example summarization) would see it. So the model's design is not clearly complete, and the tests are not clearly unfair. The instruction says 'Wherever such content is composed into a model-visible message, every such literal must be made inert before the model sees it'. That supports both a composition-site reading (the tests and the reference fix) and a before-the-model-call reading (the model). Because of this, 17 of the 23 failures, worth about 0.21 of reward, depend on how that sentence is read and not clearly on the model's competence. Under the model's reading security would be about 76/82 (≈0.93); under the tests' reading it is 0.72. No contamination, no grading-window activity and no harness errors were found. The only gap is an empty test-stdout tail; results.json is complete with 331 cases.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| security.test_command_tool_output::test_command_report_cannot_carry_a_control_literal[<|im_start\uff5c>] | fail | genuine-fail | True | True |
| security.test_command_tool_output::test_command_report_cannot_carry_a_control_literal[<\uff5cim_end|>] | fail | genuine-fail | True | True |
| security.test_envelope_special_tokens::test_web_fetch_output_cannot_carry_a_control_literal[<|im_start\uff5c>] | fail | genuine-fail | True | True |
| security.test_envelope_special_tokens::test_web_fetch_output_cannot_carry_a_control_literal[<\uff5cim_end|>] | fail | genuine-fail | True | True |
| security.test_shield_body_special_tokens::test_external_tool_output_cannot_carry_a_control_literal[<|im_start\uff5c>] | fail | genuine-fail | True | True |
| security.test_shield_body_special_tokens::test_external_tool_output_cannot_carry_a_control_literal[<\uff5cim_end|>] | fail | genuine-fail | True | True |
| security.test_kg_summary_special_tokens::test_summary_label_cannot_carry_a_control_literal[<|im_start|>] | fail | instruction-ambiguity | False | False |
| security.test_kg_summary_special_tokens::test_summary_label_cannot_carry_a_control_literal[<|im_end|>] | fail | instruction-ambiguity | False | False |
| security.test_kg_summary_special_tokens::test_summary_label_cannot_carry_a_control_literal[[INST]] | fail | instruction-ambiguity | False | False |
| security.test_kg_summary_special_tokens::test_summary_label_cannot_carry_a_control_literal[<start_of_turn>] | fail | instruction-ambiguity | False | False |
| security.test_kg_summary_special_tokens::test_summary_label_cannot_carry_a_control_literal[<|eot_id|>] | fail | instruction-ambiguity | False | False |
| security.test_kg_summary_special_tokens::test_summary_literal_is_defanged_without_an_existing_system_message | fail | instruction-ambiguity | False | False |
| security.test_kg_summary_special_tokens::test_entrypoint_label_cannot_carry_a_control_literal | fail | instruction-ambiguity | False | False |
| security.test_notification_special_tokens::test_completion_output_cannot_carry_a_control_literal[<|im_start|>] | fail | instruction-ambiguity | False | False |
| security.test_notification_special_tokens::test_completion_output_cannot_carry_a_control_literal[<|im_end|>] | fail | instruction-ambiguity | False | False |
| security.test_notification_special_tokens::test_completion_output_cannot_carry_a_control_literal[<|endoftext|>] | fail | instruction-ambiguity | False | False |
| security.test_notification_special_tokens::test_completion_output_cannot_carry_a_control_literal[<start_of_turn>] | fail | instruction-ambiguity | False | False |
| security.test_notification_special_tokens::test_completion_output_cannot_carry_a_control_literal[<end_of_turn>] | fail | instruction-ambiguity | False | False |
| security.test_notification_special_tokens::test_completion_output_cannot_carry_a_control_literal[[INST]] | fail | instruction-ambiguity | False | False |
| security.test_notification_special_tokens::test_completion_output_cannot_carry_a_control_literal[[/INST]] | fail | instruction-ambiguity | False | False |
| security.test_notification_special_tokens::test_ansi_wrapped_literal_is_defanged | fail | instruction-ambiguity | False | False |
| security.test_notification_special_tokens::test_two_completed_sessions_cannot_each_carry_a_literal | fail | instruction-ambiguity | False | False |
| security.test_notification_special_tokens::test_async_completion_output_cannot_carry_a_control_literal | fail | instruction-ambiguity | False | False |

**Lookup or leak:** None found. The transcript shows the agent reading only /workspace source and its own repository tests, with no access to hidden tests, the solution, /logs, or any network fetch (no network; DNS failures are visible in its runs). No netguard.log is present. run.json shows tool_calls_during_grading=[] and agent_events_after_end=0.

**Evidence:**
- evidence/grading/results.json: 59/82 security pass, 249/249 functional pass, reward 0.7195 = 59/82 (score.py:64)
- evidence/tests/support/helpers.py:85 FULLWIDTH = ['<｜im_start｜>', '<|im_start｜>', '<｜im_end|>']; the model passes the first and fails the two mixed forms
- evidence/final-code/changes.patch:219-400 exact-literal CONTROL_LITERALS catalog with no mixed-width entries; fix.patch:29-31 reference regex '< [|｜] ... [|｜] >'
- evidence/instruction.md:45-46 'The example above is one example, not the full set. Fix the problem and its close variants'
- evidence/instruction.md:21-28 'Wherever such content is composed into a model-visible message, every such literal must be made inert before the model sees it' (supports both composition-site and model-boundary readings)
- evidence/tests/security/test_kg_summary_special_tokens.py:44-49 calls KGMiddleware.wrap_model_call with identity handler (layer-isolated)
- evidence/tests/security/test_notification_special_tokens.py:26-36 inspects SandboxNotificationMiddleware.before_model output directly
- evidence/final-code/changes.patch:51-59 ChatTemplateGuardMiddleware appended innermost in build_middleware (conditional on UNTRUSTED_OUTPUT or PROMPT_INJECTION_SHIELD slot); changes.patch:615-624 guard neutralizes the full request
- evidence/transcript.md:324 the model inspected notifications.py; transcript.md:550 the model claims the guard covers 'summaries, notifications, derived system blocks'
- evidence/solution/fix.patch:63-107 the reference fix neutralizes at kg.py and notifications.py composition sites
- evidence/build-notes.md:116-120 the alternative-pass check used 'a different reminder composition point', still inside the notification middleware; a model-boundary guard design was never validated against the tests
- evidence/run.json: tool_calls_during_grading=[], exception_info=null; evidence/grading/test-stdout.tail.txt is empty (minor logging gap; results.json is complete with 331 cases)

**Recommended action:** Do not report 0.7195 as a clean measure of the model. The 6 mixed-width failures are genuine model shortfalls. The 17 KG and notification failures depend on whether neutralization must happen at the composition hook or may happen at a final model-call guard. Either (1) state in the instruction that each composing component must emit inert text, including state updates such as before_model reminders, or (2) add an end-to-end test that runs the KG summary and completion reminder through the assembled build_middleware stack to the model handler, plus a check of persisted-state/summarizer exposure, so that model-boundary designs are judged on actual coverage. Then re-grade this trial. Under the model's reading security would be about 76/82 (≈0.93); under the tests' reading it stays 0.72.
