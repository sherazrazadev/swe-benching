# Post-run audit: decepticon-s4__aeLUtZp

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.8929.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

Reward 0.8929 = 75/84 security tests passing, with all 249 functional tests passing. All 9 failures are the same three fullwidth-bar (U+FF5C) literals, each tested at three sites: the command report, the envelope (web_fetch) and the shield body. The model's catalog only matches ASCII-pipe specials (`_PIPE_SPECIAL = r"<\|[^\s|<>\n]{1,80}\|>"`), so none of the fullwidth forms are made inert. That is a real gap. DeepSeek's actual special tokens use the fullwidth bar (e.g. <｜begin▁of▁sentence｜>, <｜User｜>), and the model's own docstring claims DeepSeek coverage but writes those tokens with an ASCII '|'. That claim is factually wrong, and real DeepSeek control tokens would still reach the model intact. The pure-fullwidth test `<｜im_start｜>` is a fair test of that family: any fix with a generic <｜name｜> arm passes it. The two mixed-width forms (`<|im_start｜>`, `<｜im_end|>`) are not tokens in any real tokenizer. They are covered only by the instruction's general 'close variants' clause, so they are borderline (6 of the 9 failures), and the build notes call them 'genuine (if borderline)'. Even so, the model handled no fullwidth form at all and would have failed the pure-fullwidth tests anyway. So a non-1.0 reward is fair, though the exact value may be up to about 0.07 too low because of the mixed-width items. Everything else, including the hard downstream levers (banner echo, notifications, KG summary, Command-carried messages, quarantine digest), passed legitimately. The model got those through a model-call-boundary backstop (neutralize_model_request in wrap_model_call), which the helpers explicitly allow via model_boundary_text. No contamination and no harness problems.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| security.test_command_tool_output::test_command_report_cannot_carry_a_control_literal[<\uff5cim_start\uff5c>] | fail | genuine-fail | False | True |
| security.test_command_tool_output::test_command_report_cannot_carry_a_control_literal[<|im_start\uff5c>] | fail | instruction-ambiguity | False | False |
| security.test_command_tool_output::test_command_report_cannot_carry_a_control_literal[<\uff5cim_end|>] | fail | instruction-ambiguity | False | False |
| security.test_envelope_special_tokens::test_web_fetch_output_cannot_carry_a_control_literal[<\uff5cim_start\uff5c>] | fail | genuine-fail | False | True |
| security.test_envelope_special_tokens::test_web_fetch_output_cannot_carry_a_control_literal[<|im_start\uff5c>] | fail | instruction-ambiguity | False | False |
| security.test_envelope_special_tokens::test_web_fetch_output_cannot_carry_a_control_literal[<\uff5cim_end|>] | fail | instruction-ambiguity | False | False |
| security.test_shield_body_special_tokens::test_external_tool_output_cannot_carry_a_control_literal[<\uff5cim_start\uff5c>] | fail | genuine-fail | False | True |
| security.test_shield_body_special_tokens::test_external_tool_output_cannot_carry_a_control_literal[<|im_start\uff5c>] | fail | instruction-ambiguity | False | False |
| security.test_shield_body_special_tokens::test_external_tool_output_cannot_carry_a_control_literal[<\uff5cim_end|>] | fail | instruction-ambiguity | False | False |

**Lookup or leak:** None found. The transcript shows the agent reading and running only the repository's own project tests under /workspace/packages/*/tests and writing its own test_control_literals.py. There is no access to the hidden evidence/tests suite and no network or upstream lookup (no netguard.log present; no curl, pip or GitHub fetches in the transcript). The model's design (a new control_literals.py module plus a model-call backstop) differs from the reference fix.patch, so this was not copied.

**Evidence:**
- grading/results.json: 9 security failures, all U+FF5C variants; all 249 functional tests pass; reward 0.8929 = 75/84 per score.py:64
- tests/support/helpers.py:158 FULLWIDTH = ["<｜im_start｜>", "<|im_start｜>", "<｜im_end|>"]
- final-code/changes.patch:77 `_PIPE_SPECIAL = r"<\|[^\s|<>\n]{1,80}\|>"` ASCII pipe only
- final-code/changes.patch:41-43 docstring claims DeepSeek coverage, written as '<|begin▁of▁sentence|>' with an ASCII bar (real DeepSeek tokens use U+FF5C)
- solution/fix.patch:26-31 the reference accepts '[|｜]' independently on each end
- instruction.md:22-25 defines a control literal by tokenizer parsing; instruction.md:41-42 'Fix the problem and its close variants'
- build-notes.md:129-131 the mixed ASCII/fullwidth forms were kept in scope as a 'genuine (if borderline)' shortfall
- final-code/changes.patch:495,539 neutralize_model_request in wrap_model_call is the boundary backstop that legitimately passes the KG, notification and digest levers via helpers.model_boundary_text
- run.json timing: tool_calls_during_grading is empty, exception_info is null

**Recommended action:** Accept as model-failed: the model missed the fullwidth-bar (DeepSeek) token family. Note that 6 of the 9 failures are mixed-width forms that are not real tokenizer tokens; a fix covering each real family would still score about 0.929, not 1.0. To make the tests strictly fair, consider replacing the mixed-width cases with real fullwidth tokens (e.g. <｜User｜>, <｜end▁of▁sentence｜>) or naming width-mixing as in scope.
