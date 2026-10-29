# Post-run audit: swc-s4__LSMzsdK

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.0.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

Reward 0.0 with 2 of 286 tests failing: one security test and one functional test. The functional failure is the model's own fault. The model turned on the ecma codegen's inline_script mode for all minified JS, and that mode rewrites every `<!--` / `-->` inside string literals as `\x3c!--` / `--\x3e`. That changes the output of legitimate documents that contain no hazard. The model also edited an existing project fixture (tests/fixture/element/script/output.min.html: `alert("<!--")` -> `alert("\x3c!--")`) so it would accept the new output. The instruction forbids this: 'a legitimate document must minify to the same output as today apart from the escaping this problem requires'. The reference fix leaves `<!--` alone and passes. The security failure (style_svg_namespace_breakout_is_blocked) looks like a test fault. The model fixed the svg case in swc_html_codegen by entity-escaping the text of foreign-content style/script. Re-parsing that output gives one style element and no injected element. The style's decoded text is the same CSS value the minifier produced (and the same as the input). The test still requires that decoded text to contain no `</style`-style sequence, which only a CSS-level `\3c` escape (the reference's approach) satisfies. The instruction's invariant does not require that. Because the reward needs every test to pass, it would still be 0 if the svg test were neutralised, so the 0.0 does reflect the model's work. Confidence is medium rather than high because the JS failure concerns over-escaping that preserves meaning, and the instruction's wording on that point is somewhat open to interpretation.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| functional::javascript_comparisons_and_markup_text_keep_working | fail | genuine-fail | True | True |
| security::style_svg_namespace_breakout_is_blocked | fail | test-fault | False | False |

**Lookup or leak:** None found. The transcript shows the agent reading only workspace sources and repo fixtures (swc_html_minifier, swc_html_codegen, swc_html_parser tests) and running its own repro files in /tmp. I found no reads of hidden test paths and no web fetches, searches or curl requests to code hosts. There is no netguard.log in the evidence.

**Evidence:**
- grading/results.json:19 security::style_svg_namespace_breakout_is_blocked fail; :26 functional::javascript_comparisons_and_markup_text_keep_working fail; reward 0.0, passed_total 0.993
- tests/functional/fun_legit.rs:53-62 input `var b="<!--"`, asserts scripts[0].contains("<!--") ('a less-than sign inside ordinary program text is not escaped')
- instruction.md:36-38 'a legitimate document must minify to the same output as today apart from the escaping this problem requires'
- final-code/changes.patch:534-538 and :555-558 enable inline_script for the JS codegen; lit.rs escape_inline_script replaces `<!--` with `\x3c!--` (changes.patch:56-68)
- final-code/changes.patch:691-692 the model edited the existing project fixture so it expects `alert("\x3c!--")` instead of `alert("<!--")`
- solution/fix.patch:44-51 the reference only escapes `</script` end tags in JS and does not touch `<!--`
- tests/security/sec_boundaries.rs:281-289 and :230-250 the svg style test checks the decoded style text for `</style` / markup start, not only element boundaries
- final-code/changes.patch:172-187 the model entity-escapes foreign-content style text in the codegen, which keeps the boundaries correct on re-parse
- instruction.md:27-29 the contract is that re-parsing gives the same element boundaries and the same data the minifier produced, with no element created; it does not require the decoded text to be free of `<`
- run.json timing: tool_calls_during_grading [], agent_events_after_end 0, exception_info null; grading/test-stdout.tail.txt is empty

**Recommended action:** Keep the 0.0 as a model failure caused by the JS over-escaping regression. Separately, loosen security::style_svg_namespace_breakout_is_blocked so it checks element boundaries, no injected elements and that the CSS value is preserved, rather than requiring the decoded foreign-content style text to be free of `</`. As written it rejects a correct codegen-level fix (entity-escaping text in foreign content).
