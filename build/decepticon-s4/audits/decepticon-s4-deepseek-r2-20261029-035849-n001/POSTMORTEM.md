# Post-run audit: decepticon-s4__jZjCCYj

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.9286.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

Reward 0.9286 = 78/84 security tests, 249/249 functional (threshold scoring, score.py:58-64). The model built a broad chat-template sanitizer (new chat_template_sanitizer.py) and applied it at the envelope body, shield wrap body, shield banner, notification reminder, KG summary, Command-carried messages, the model-call boundary and the LLM payload. Every one of the seven routes passes. All 6 failures have one root cause: the mixed ASCII/fullwidth-bar literals `<|im_start\uff5c>` and `<\uff5cim_end|>`. The model's regex matches `<|...|>` and `<\uff5c...\uff5c>` as separate alternatives (changes.patch:410-411), so a literal that mixes the two bar widths matches neither. The instruction never names width-mixing; it says only 'close variants' (instruction.md:41-42). Still, the model itself identified bar width as a variant axis and handled both pure forms, including a generic fullwidth ChatML form, which is not a DeepSeek vocabulary token. Under that threat model the mixed forms are an obvious sibling, and the reference fix covers them deliberately with `[|\uff5c]` on each side (fix.patch:26-31). A fix that accepted either bar on each end would pass. This is borderline because a fix grounded strictly in exact tokenizer vocabularies would also miss these forms. Even so, the model's own design already went past exact vocabularies and left an internal gap, so I attribute the shortfall to the model with medium confidence. I found no harness problems and no contamination.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| security.test_command_tool_output::test_command_report_cannot_carry_a_control_literal[<|im_start\uff5c>] | fail | genuine-fail | False | True |
| security.test_command_tool_output::test_command_report_cannot_carry_a_control_literal[<\uff5cim_end|>] | fail | genuine-fail | False | True |
| security.test_envelope_special_tokens::test_web_fetch_output_cannot_carry_a_control_literal[<|im_start\uff5c>] | fail | genuine-fail | False | True |
| security.test_envelope_special_tokens::test_web_fetch_output_cannot_carry_a_control_literal[<\uff5cim_end|>] | fail | genuine-fail | False | True |
| security.test_shield_body_special_tokens::test_external_tool_output_cannot_carry_a_control_literal[<|im_start\uff5c>] | fail | genuine-fail | False | True |
| security.test_shield_body_special_tokens::test_external_tool_output_cannot_carry_a_control_literal[<\uff5cim_end|>] | fail | genuine-fail | False | True |

**Lookup or leak:** None found. The transcript shows the agent reading only the repository's own unit tests under /workspace/packages/decepticon/tests/unit (transcript.md:13,25,77,127) and running local pytest/ruff. It made no fetches to a code host or package registry, and no netguard.log is present. It did not access the hidden tests (support/helpers.py, security/*). run.json shows 0 agent events after agent_end and no tool calls during the grading window.

**Evidence:**
- grading/results.json:7-8,25-26,78-79 - the only 6 failures are the [<|im_start\uff5c>] and [<\uff5cim_end|>] params; all other 78 security and all 249 functional tests pass
- tests/support/helpers.py:158 - FULLWIDTH = ["<\uff5cim_start\uff5c>", "<|im_start\uff5c>", "<\uff5cim_end|>"]
- final-code/changes.patch:410-411 - r"<\|[^\s<>\u200b]{1,96}\|>" | r"<\uff5c[^\s<>\u200b]{1,96}\uff5c>" (same-width pairs only)
- solution/fix.patch:26-31 - reference: 'accepts ASCII | and fullwidth \uff5c on each end independently, so half/full-width mixing cannot slip past'
- instruction.md:22-25,41-42 - literal defined by tokenizer behaviour; 'Fix the problem and its close variants'
- build-notes.md:129-131 - the task authors kept mixed-width forms in scope deliberately as a 'close variant' and acknowledged them as borderline
- tests/score.py:58-64 - reward = security pass share when functional is all green (78/84 = 0.9286)
- run.json timing - tool_calls_during_grading: [], agent_events_after_end: 0
- grading/test-stdout.tail.txt - empty; results.json is complete, with no error/skip entries

**Recommended action:** Accept the reward of 0.9286 as a fair measure, and flag it as borderline. The failures come from a real, if narrow, gap in the model's own fullwidth handling. To remove the ambiguity in future versions, consider stating in the instruction that bar or delimiter width may vary independently, or justify the mixed forms with a tokenizer-normalization rationale in the task docs. No regrade is needed.
