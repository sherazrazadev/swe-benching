# Post-run audit: swc-s4__f73n3Y5

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.0.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** high

The agent hit the 10800 s agent timeout (run.json exception_info: AgentTimeoutError) before it changed any product behaviour. The graded tree has only three added files (changed_files.tsv): two scratch test files (crates/swc_html_parser/tests/scratch_check.rs, crates/swc_html_minifier/tests/scratch_check.rs) and an orphan module crates/swc_html_minifier/src/content_escape/script_data.rs. That module is a script-data tokenizer simulation, but lib.rs was never modified and no content_escape/mod.rs exists, so it is never compiled into the crate. The minifier was therefore graded as the unmodified vulnerable baseline. All 18 security tests failed, which matches the builder's nop baseline exactly (build-notes.md:213 "hidden security 0/18 pass"). All 12 hidden functional tests and all 249 project fixtures passed because nothing changed. The transcript ends mid-exploration (transcript.md:346-347, still reading swc_ecma_parser lexer internals). Its last stated plan was "Now I'll write the fix" (transcript.md:314), but only the simulation file followed. No tool calls fell inside the grading window (run.json timing.tool_calls_during_grading = []), and the harvest was taken after the run. Several security tests go beyond the literal example: style/CSS, the custom HTML script type, SVG foreign content and the combined/structured JSON serializers. Most of these follow from the instruction's generalized invariant, which covers every rewritten element, every option, every location and every re-producer. Even if some were debatable, the reward would still be 0. The most direct test, json_application_json_breakout_is_blocked, is the instruction's own example, a unicode-escaped '<' in JSON script data, and the model left it unfixed. The reward of 0.0 is a fair measure of the work.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| security::json_application_json_breakout_is_blocked | fail | genuine-fail | True | True |
| security::json_ld_nested_breakout_is_blocked | fail | genuine-fail | True | True |
| security::json_import_map_breakout_is_blocked | fail | genuine-fail | True | True |
| security::json_speculation_rules_breakout_is_blocked | fail | genuine-fail | True | True |
| security::json_custom_script_type_breakout_is_blocked | fail | genuine-fail | True | True |
| security::json_pretty_output_breakout_is_blocked | fail | genuine-fail | True | True |
| security::json_svg_namespace_breakout_is_blocked | fail | genuine-fail | True | True |
| security::json_template_content_breakout_is_blocked | fail | genuine-fail | True | True |
| security::json_document_fragment_breakout_is_blocked | fail | genuine-fail | True | True |
| security::json_combined_data_blocks_breakout_is_blocked | fail | genuine-fail | True | True |
| security::js_uppercase_end_tag_breakout_is_blocked | fail | genuine-fail | True | True |
| security::js_whitespace_end_tag_breakout_is_blocked | fail | genuine-fail | True | True |
| security::js_module_uppercase_end_tag_breakout_is_blocked | fail | genuine-fail | True | True |
| security::style_string_escape_breakout_is_blocked | fail | genuine-fail | True | True |
| security::style_url_escape_breakout_is_blocked | fail | genuine-fail | True | True |
| security::style_svg_namespace_breakout_is_blocked | fail | genuine-fail | True | True |
| security::custom_css_script_breakout_is_blocked | fail | genuine-fail | True | True |
| security::custom_html_script_breakout_is_blocked | fail | genuine-fail | True | True |

**Lookup or leak:** None found. The transcript has no WebFetch or WebSearch calls, no git fetch, clone, curl or wget, and no access to the hidden tests (sec_boundaries.rs, fun_legit.rs) or grader paths. The agent read only /workspace sources and existing project fixtures. No netguard.log is present.

**Evidence:**
- evidence/run.json: exception_type AgentTimeoutError, 'Agent execution timed out after 10800.0 seconds'; tool_calls_during_grading []
- evidence/final-code/changed_files.tsv: only 3 added files, 2 scratch tests + src/content_escape/script_data.rs; lib.rs not modified, so the module is never compiled in
- evidence/final-code/changes.patch:63-348: script_data.rs is a standalone tokenizer simulation with no callers
- evidence/transcript.md:314: 'All APIs confirmed. Now I'll write the fix. First, the script-data state machine simulation:'; nothing was wired afterwards
- evidence/transcript.md:346-347: the transcript ends while the agent is still reading swc_ecma_parser lexer internals
- evidence/grading/results.json: 18/18 security fail, 12/12 hidden functional + 249 project pass, reward 0.0
- evidence/build-notes.md:213: the vulnerable baseline gives 'hidden security 0/18 pass (18 fail); hidden functional 12/12 pass', identical to this run
- evidence/build-notes.md:215-217: the reference fix and an independent alternative fix both pass all 18 security tests plus the functional tests
- evidence/tests/security/sec_boundaries.rs:37-44: the core test is the instruction's own example (unicode-escaped '<' in JSON script data)
- evidence/instruction.md:17-23: the invariant explicitly covers every rewritten element, every option, every location and every re-production path

**Recommended action:** Keep the reward of 0.0 as a valid model failure. The agent spent the whole 3-hour budget exploring and never wired in any fix. No regrade or task change is needed for this trial.
