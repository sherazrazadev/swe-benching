# Post-run audit: swc-s4__HJof67r

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.0.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** high

Reward 0.0 with 3 of 293 tests failing (passed_total 0.99). Grading ran cleanly: no exception, and no agent tool calls happened inside the grading window (run.json timing). The model wrote a broad fix. It handles JSON, JS, CSS, custom script types, merges, structured JSON and fragments, and adds a roundtrip test. But it only escapes the element's own end tag (and `<!--` for script). That is not enough for script/style elements in the SVG namespace. In foreign content the text is parsed as markup, so a minifier-decoded `<img id=pwned>` still creates an element. This is why both *_svg_namespace security tests fail. The instruction covers this case explicitly ('wherever in the document or fragment it sits', 'every such element'). The reference fix handles it: it escapes every `<` in JSON and escapes markup starts in SVG stylesheets. The build notes say a `</`-only alternative was rejected by this same SVG test. The model also switched on swc_ecma_codegen's inline_script mode for all minified JS. That changes legitimate output: `"<!--"` becomes `"\x3c!--"`, and the model even rewrote the existing element/script fixture's expected output to match. This breaks the functional test that requires ordinary program text to stay unescaped. The instruction requires 'the same output as today apart from the escaping this problem requires', and a lone `<!--` cannot change element boundaries. That test is slightly strict, because the escaped form keeps the same JS meaning. Even so, the two SVG security failures alone give reward 0 and are clear shortfalls. No contamination was found.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| security::json_svg_namespace_breakout_is_blocked | fail | genuine-fail | True | True |
| security::style_svg_namespace_breakout_is_blocked | fail | genuine-fail | True | True |
| functional::javascript_comparisons_and_markup_text_keep_working | fail | genuine-fail | True | True |

**Lookup or leak:** None found. The transcript shows the agent exploring the workspace source, writing its own probe scripts under /tmp/rep and running the project's own cargo tests. It never references the hidden test files (sec_boundaries/fun_legit/run_group/score.py) and never fetches upstream or GitHub code. run.json reports no tool calls during grading.

**Evidence:**
- evidence/grading/results.json:16,19,26 - the three failures; every other security, functional and project test passes
- evidence/run.json:12-20 - agent ended 18:05:33, grading 18:06:10-18:10:29, tool_calls_during_grading []
- evidence/tests/security/sec_boundaries.rs:103-110 - SVG JSON test asserts no injected id=pwned and valid JSON
- evidence/tests/security/sec_boundaries.rs:281-289 - SVG style test asserts no markup start in the stylesheet
- evidence/tests/functional/fun_legit.rs:52-69 - `<!--` inside a string must stay unescaped
- evidence/final-code/changes.patch:315-351 - escape_json_script_data only escapes `<!--` and `</script`
- evidence/final-code/changes.patch:358-394 - escape_css_raw_text only escapes the end tag
- evidence/final-code/changes.patch:80-82 - options.codegen.inline_script = true
- evidence/final-code/changes.patch:584-585 - model rewrote existing fixture: alert("<!--") -> alert("\x3c!--")
- evidence/solution/fix.patch:22-28,195-244 - reference escapes every `<` in JSON and markup starts in SVG CSS
- evidence/build-notes.md:52-54,102-104 - SVG foreign content makes `</`-only escaping insufficient; such an alternative was rejected by this test
- evidence/instruction.md:21-23 - invariant holds 'wherever in the document or fragment it sits'
- evidence/instruction.md:36-38 - same output as today apart from required escaping

**Recommended action:** Keep the reward of 0.0 as a valid model failure. Optionally, the task author could clarify in the functional test message that escaping a lone `<!--` counts as a regression. This would not change the verdict, because the two SVG security failures stand on their own.
