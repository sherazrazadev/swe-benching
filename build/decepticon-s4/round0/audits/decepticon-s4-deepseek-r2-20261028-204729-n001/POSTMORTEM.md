# Post-run audit: decepticon-s4__PbBG8qY

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.0.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

Reward 0.0 reflects real shortfalls in the model's work. The model wrote a broad, careful neutralizer (_chat_template.py) and applied it to the envelope, shield body and banner, notifications, KG summary and every model-request path, so 69 of 82 security tests pass. But it missed one route completely: a tool that reports through a langgraph Command(update={'messages': [...]}). Both wrappers still return non-ToolMessage results untouched, so all 7 test_command_tool_output tests fail. The instruction covers this ('No content that enters the product through a tool result ... may reach any message the model reads'), and the reference fix handles it with _neutralize_command_messages. The transcript never mentions crawl_archive; the model did not look for Command-returning tools. Those 7 failures alone give reward 0. Other failures: (a) mixed half/full-width pipe variants '<|im_start｜>' and '<｜im_end|>' fail because the model's regexes require matching delimiters on both ends. The instruction says 'close variants', but no real tokenizer has a mixed-pipe token, so this part is somewhat ambiguous. (b) Two benign-passthrough functional tests fail because the model's overbroad pattern <\|[^<>\n]{1,120}\|> also defangs the benign '<| not a token |>'. That conflicts with the stated byte-for-byte contract for non-control bracket text, so it is a model fault. (c) test_digest_keeps_tool_risk_and_excerpt_readable fails. I could not confirm the cause because the grader stdout is empty. The likely cause is the model's unrequested broadening of the detector's im-start regex in _injection_detector.py: it narrows the match span, which changes the ledger excerpt windows. That breaks 'everything the product does today keeps working exactly as today'. The test is somewhat brittle here, but a fix that leaves the detector alone, as the reference does, passes. No harness problems: there were no tool calls during the grading window and no exception. No contamination found.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| security.test_command_tool_output::test_command_report_cannot_carry_a_control_literal[*] (6 params) | fail | genuine-fail | True | True |
| security.test_command_tool_output::test_command_report_is_defanged_in_either_wrapper_order | fail | genuine-fail | True | True |
| security.test_envelope_special_tokens::test_web_fetch_output_cannot_carry_a_control_literal[<|im_start\uff5c>] and [<\uff5cim_end|>] | fail | instruction-ambiguity | False | True |
| security.test_shield_body_special_tokens::test_external_tool_output_cannot_carry_a_control_literal[<|im_start\uff5c>] and [<\uff5cim_end|>] | fail | instruction-ambiguity | False | True |
| functional.test_envelope_preservation::test_benign_bracket_content_passes_through_byte_for_byte | fail | genuine-fail | True | True |
| functional.test_shield_preservation::test_benign_bracket_content_passes_through_byte_for_byte | fail | genuine-fail | True | True |
| functional.test_digest_preservation::test_digest_keeps_tool_risk_and_excerpt_readable | fail | genuine-fail | True | True |

**Lookup or leak:** None found. The transcript shows only in-repo reads (project unit tests under packages/decepticon/tests/unit, product modules, docs). The only 'github' hit is a URL inside a repo docs file. There are no reads of hidden test paths (tests/security, tests/functional, support/helpers) and no network fetches. The model wrote its own regression tests.

**Evidence:**
- evidence/grading/results.json:3-9 - all 7 test_command_tool_output tests fail
- evidence/tests/security/test_command_tool_output.py:24-53 - crawl_archive_digest returns Command; the test checks Command.update messages after both wrappers
- evidence/solution/fix.patch:159-186,253-258 - the reference adds _neutralize_command_messages for Command results
- evidence/final-code/changes.patch:138-148,269-285 - the model's wrap paths only handle ToolMessage; no Command branch
- evidence/instruction.md:21-28 - 'No content that enters the product through a tool result ... may reach any message the model reads'
- evidence/final-code/changes.patch:478 - _PIPE_DELIMITED = <\|[^<>\n{_INERT_CHARS}]{1,120}\|> (overbroad; also requires matching delimiters)
- evidence/tests/support/helpers.py:108 - benign_text contains '<| not a token |>'
- evidence/instruction.md:35-37 - benign bracket text that is not a control literal must pass byte-for-byte
- evidence/solution/fix.patch:31 - the reference vbar arm uses [|\uff5c] on each end independently with [A-Za-z0-9_]{1,48}
- evidence/final-code/changes.patch:870-871 - the model broadened the detector's im-start-chatml regex (affects ledger excerpts used by the digest)
- evidence/run.json:13-19 - no tool calls during the grading window; exception_info null
- evidence/build-notes.md:42-45 - T6 Command-carried message is a documented, intended lever

**Recommended action:** Accept reward 0.0 as a genuine model failure. The missed Command-update route (7 security tests) alone decides the outcome and is clearly covered by the instruction. Optional task follow-up: the mixed half/full-width pipe variants are not real tokenizer tokens, so the instruction could name delimiter-mixing variants explicitly. The digest functional test depends on detector excerpt-window geometry and could be made less sensitive to legitimate detector changes. Neither change would alter this trial's reward.
