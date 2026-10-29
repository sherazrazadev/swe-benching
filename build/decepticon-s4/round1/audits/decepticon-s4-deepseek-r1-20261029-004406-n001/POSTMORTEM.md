# Post-run audit: decepticon-s4__JtvAFaL

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.8929.

**Trustworthy:** False  **Attribution:** instruction-ambiguity  **Confidence:** medium

Reward 0.8929 = 75/84 security tests passing, 249/249 functional passing. All 9 failures are the same three FULLWIDTH parametrizations (`<｜im_start｜>`, `<|im_start｜>`, `<｜im_end|>`), one set in each of three test functions (command report, web_fetch envelope, shield body). Every other lever (envelope, shield body, banner echo, notifications, KG summary, Command-carried messages, ledger digest, content blocks, repeated literals) passes. The model's fix (new `_chat_template.py`) matches an explicit list of real tokenizer special tokens across many model families, including DeepSeek's real fullwidth-bar spellings (`<｜begin▁of▁sentence｜>`, `<｜User｜>`, ...). It deliberately avoids a generic `<|word|>` pattern so that non-control text passes through byte-for-byte. The instruction defines a control literal as a sequence 'that a supported model's tokenizer parses as a structural role, turn, or boundary token'. `<｜im_start｜>` and the mixed-width forms are not special tokens in any tokenizer the evidence names. The reference fix catches them only because its regex treats ASCII and fullwidth bars as interchangeable, on each end independently, around any word. Requiring these forms rests on the vague 'close variants' clause, and that clause pulls against the instruction's own tokenizer-based definition and its byte-for-byte contract. The task author's build notes call these forms 'borderline' and say they were kept on purpose without being named, to avoid a variant-list hint. So a reasonable, principled fix fails only on this one disputed requirement. The model's remaining work looks genuinely strong. The 0.89 measures how the task author chose to read 'close variants', not a clear model shortfall. I found no contamination and no harness problems.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| security.test_command_tool_output::test_command_report_cannot_carry_a_control_literal[<\uff5cim_start\uff5c>, <|im_start\uff5c>, <\uff5cim_end|>] (3 params) | fail | instruction-ambiguity | False | False |
| security.test_envelope_special_tokens::test_web_fetch_output_cannot_carry_a_control_literal[<\uff5cim_start\uff5c>, <|im_start\uff5c>, <\uff5cim_end|>] (3 params) | fail | instruction-ambiguity | False | False |
| security.test_shield_body_special_tokens::test_external_tool_output_cannot_carry_a_control_literal[<\uff5cim_start\uff5c>, <|im_start\uff5c>, <\uff5cim_end|>] (3 params) | fail | instruction-ambiguity | False | False |

**Lookup or leak:** None found. The agent listed /logs/verifier and /logs/artifacts (transcript.md:150-151), but both were empty. It read only the repository's own unit tests under /workspace/packages/decepticon/tests. The transcript shows no network or upstream lookup, and no netguard.log is present. Its fix differs structurally from the reference: a separate module, an exact-match catalog, and a model-boundary middleware instead of the reference's regex in _injection_detector.

**Evidence:**
- evidence/grading/results.json:6-8,24-26,77-79 — the only 9 failures, all FULLWIDTH params; functional 249/249 pass
- evidence/tests/support/helpers.py:158 — FULLWIDTH = ["<｜im_start｜>", "<|im_start｜>", "<｜im_end|>"]
- evidence/instruction.md:23-25 — control literal defined as 'any character sequence that a supported model's tokenizer parses as a structural role, turn, or boundary token'
- evidence/instruction.md:33 — 'Text that is not a control literal must pass through byte-for-byte'
- evidence/instruction.md:41-42 — only 'close variants' hints at the forms beyond the example
- evidence/solution/fix.patch:26-31 — reference regex `< [|｜] [A-Za-z0-9_]{1,48} [|｜] >` treats either bar as interchangeable on each end, around any word
- evidence/final-code/changes.patch:228-230,316-339 — model's exact catalog, which avoids a generic `<|...|>` pattern and includes the real DeepSeek fullwidth tokens
- evidence/build-notes.md:129-131 — task author keeps the mixed ASCII/fullwidth forms, which earlier audits called 'borderline', without naming them
- evidence/run.json:12-20 — no tool calls during the grading window; exception_info null
- evidence/transcript.md:150-151 — /logs/verifier was empty when the agent inspected it

**Recommended action:** Do not report 0.8929 as a clean model-failed score. Either (a) state in the instruction that delimiter look-alikes (for example fullwidth `｜` versus ASCII `|`, mixed on either side) count as control literals, or (b) remove the FULLWIDTH params, or report them as a separate, non-gating robustness metric. Under the instruction as written, this run is best reported as fully solving the stated security property (75/75 on unambiguous literals, 249/249 functional) with a disputed fullwidth-variant gap.
