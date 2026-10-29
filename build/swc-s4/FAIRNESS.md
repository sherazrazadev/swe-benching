# FAIRNESS review — swc-s4

Coverage keys: **P** = Invariant: "no value carried by the document and no data the minifier produces from it may end the element that holds it … no markup may be created from that data". **Q** = its scope: "every such element — whatever kind of content it holds, whatever options the caller passes, wherever in the document or fragment it sits, and however that content was produced or re-produced along the way". **R** = "Parsing it again must give the same element boundaries and the same data the minifier produced, with no element created from text that belonged to a minified element". **T** = "Everything that works today keeps working … same output as today apart from the escaping this problem requires, and its data and its program must keep their meaning". **E** = standard expert knowledge (stated in cell).

## 1. Test-by-test fairness

| Test (file::name) | What it asserts | Instruction coverage | Could a correct fix fail? | Risk |
|---|---|---|---|---|
| sec_boundaries.rs::json_application_json_breakout_is_blocked | application/json `</script>` yields one script, no `#pwned`, valid JSON whose value is `</script><img id=pwned>` | P, R | no — escaping `<` (or leaving the input) re-parses and the value assertion accepts any valid JSON escape | low |
| sec_boundaries.rs::json_ld_nested_breakout_is_blocked | same for nested object/array values and scalar types | P, Q, R | no | low |
| sec_boundaries.rs::json_import_map_breakout_is_blocked | same through the importmap serializer | P, Q ("produced … along the way"), R | no | low |
| sec_boundaries.rs::json_speculation_rules_breakout_is_blocked | same through the speculationrules serializer | P, Q, R | no | low |
| sec_boundaries.rs::json_custom_script_type_breakout_is_blocked | caller maps `text/custom-json` to JSON | P, Q ("whatever options") | no | low |
| sec_boundaries.rs::json_pretty_output_breakout_is_blocked | pretty option; valid JSON, value kept | P, Q | no | low |
| sec_boundaries.rs::json_svg_namespace_breakout_is_blocked | JSON script inside `<svg>`; no markup, value kept | P ("no markup"), Q; E: foreign content parses text as markup, so every `<` matters | no — an only-`</` escape is incomplete under P read literally | low-med |
| sec_boundaries.rs::json_template_content_breakout_is_blocked | script inside `<template>` | P, Q ("wherever … it sits") | no | low |
| sec_boundaries.rs::json_document_fragment_breakout_is_blocked | `minify_document_fragment` path | P, Q ("fragment") | no | low |
| sec_boundaries.rs::json_combined_data_blocks_breakout_is_blocked | two adjacent arrays combine to one script; value kept; no markup | P, R, T | no — escaping keeps the merge; dropping it changes today's output (T) | low-med |
| sec_boundaries.rs::js_uppercase_end_tag_breakout_is_blocked | `</SCRIPT>` synthesized; no markup, `__marker` kept | P; E: tag names are ASCII case-insensitive | no | low |
| sec_boundaries.rs::js_whitespace_end_tag_breakout_is_blocked | `</script >` synthesized | P; E: `>`/`/`/whitespace terminate an end tag | no | low |
| sec_boundaries.rs::js_module_uppercase_end_tag_breakout_is_blocked | same with `type=module` | P, Q; E | no | low |
| sec_boundaries.rs::style_string_escape_breakout_is_blocked | CSS string `\3c ` decodes to `<`; no `</style`, data kept | P, Q ("every element whose content the minifier rewrites") | no — `<\/style` or `\3c ` escaping passes | low-med |
| sec_boundaries.rs::style_url_escape_breakout_is_blocked | same for `url()` | P, Q | no | low-med |
| sec_boundaries.rs::style_svg_namespace_breakout_is_blocked | SVG style text must not start markup | P ("no markup"); E: foreign content is parsed as markup | no — literal P requires escaping markup starts | medium |
| sec_boundaries.rs::custom_css_script_breakout_is_blocked | caller maps a type to css, held in a `script`; no `</script`, data kept | P, Q ("options") | no | low-med |
| sec_boundaries.rs::custom_html_script_breakout_is_blocked | caller maps a type to html; no `</script`, data kept | P, Q ("options", "produced") | no — bail-out (reference) and entity escaping both pass | low-med |
| fun_legit.rs::json_values_and_types_are_preserved | text/number/bool/null/array/object values kept | T (data keeps meaning, "escaped form decodes") | no | low |
| fun_legit.rs::json_pretty_output_stays_pretty_and_valid | newlines kept; values kept | T ("pretty output stays pretty") | no | low |
| fun_legit.rs::javascript_comparisons_and_markup_text_keep_working | `<!--` and `a<b` stay unescaped; side effect kept | T ("apart from the escaping this problem requires") | no — over-escaping is what T forbids | low |
| fun_legit.rs::javascript_end_tag_spelling_inside_source_keeps_working | `</b>`/`/a<b/` preserved; program kept | T | no | low |
| fun_legit.rs::combined_json_data_blocks_are_combined_and_valid | safe arrays still combine, values kept | T | no | low |
| fun_legit.rs::json_object_blocks_are_not_combined | object blocks stay separate | T | no | low |
| fun_legit.rs::structured_data_normalization_keeps_meaning | importmap drops empty target; speculation dedupes | T | no | low |
| fun_legit.rs::stylesheet_minification_keeps_its_output | exact today's output | T | no | low |
| fun_legit.rs::stylesheet_strings_and_media_queries_keep_their_value | exact output; `a<b`, `width < 600px` unescaped | T | no | low |
| fun_legit.rs::style_and_media_attributes_keep_their_output | exact attribute outputs | T | no | low |
| fun_legit.rs::custom_css_script_keeps_being_minified | exact safe output | T | no | low |
| fun_legit.rs::custom_html_script_keeps_being_minified | exact safe output | T | no | low |

## 2. Leniency (non-blocking)

- **json_script_text**: input-side escape is caught by all JSON tests (`sf_input_check`); escaping only `</` is caught by `json_svg_namespace`; entity escaping is caught by the value asserts. **Uncaught:** skipping minification when JSON contains `<` — the original `<` text is valid JSON and decodes correctly, so every security assert still passes.
- **js_end_tag_spellings**: exact-case replace is caught (`js_uppercase`, `js_whitespace`; `sf_no_js_escape`); all-`<` over-escape is caught (`javascript_comparisons…`; `ff_overbroad`). **Uncaught:** missing `/`, tab, LF, CR or FF terminators; stripping or `&lt;`-encoding the payload (asserts only need `__marker`, one script, no `#pwned`; no decoded value is checked).
- **structured_json_serializer**: escape only in the generic arm is caught (`json_import_map`, `json_speculation_rules`; `sf_no_structured_escape`).
- **combined_data_blocks**: main-pass-only escape is caught (`json_combined_data_blocks…`; `sf_no_merge_escape`); declining to merge is caught by its `scripts.len()==1`.
- **style_raw_text**: a script-only guard is caught (three style tests; `sf_no_style_escape`); `</style`-only is caught by `style_svg_namespace`. **Uncaught:** skipping a dangerous HTML-namespace stylesheet (the original `\3c ` text has no literal `<`); no test decodes the CSS value.
- **custom_css_script**: a style-terminator/unchanged fix is caught (`sf_no_custom_css_escape`). **Uncaught:** value-changing escape, skip-on-danger, and SVG-namespace custom CSS.
- **custom_html_script**: trusting the nested serializer is caught (`sf_no_custom_html_guard`); unconditional over-escape is caught by its functional pair. **Uncaught:** missing the SVG markup-start branch.
- **Also uncovered:** a JS script in SVG foreign content (the reference leaves it open; no test drives it); most breakouts are detected via `id=pwned` rather than markup generally.

## 3. Hints (non-blocking)

- "The data had been written into the document in an escaped form, and minification turned the escaped bytes back into the characters a browser uses to delimit the element." — states the mechanism. Reword to the outcome: "the same document was safe unminified but produced markup once minified."
- "Reproducing it needed only a document whose script data had been written with a unicode escape for `<`" — names the exact trigger. Reword: "the report included one document that reproduced it; that case is an example."
- "pretty output stays pretty" and "text stays text, numbers stay numbers, booleans and nulls stay themselves, and object and array shape is preserved" — enumerate the pretty option and JSON value types. Reword: "the output keeps the value, type, structure and format the caller asked for."
- "escapes characters in ordinary program text so that it no longer does what it did" — paraphrases the over-broad trap. Reword: "does not change legitimate text."
- Library/entry-point names (`swc_html_minifier`, `minify_document`, `minify_document_fragment`, `@swc/html`) are surface names but needed to identify the API; keep.

## 3a. Required: generalize

- "pretty output stays pretty" — an option/format that only the pretty test exercises. Replace with: "the output keeps the format the caller asked for."
- "text stays text, numbers stay numbers, booleans and nulls stay themselves, and object and array shape is preserved" — a JSON type list mirroring individual assertions. Replace with: "the data keeps its value, type and structure."
- "data written in escaped form decodes to the same value as before" — names the escalation format. Replace with: "the data decodes to the value it carried before minification."
- No sentence names a sibling or far route; the "every such element … however that content was produced" sentence is the correct single general property — keep it.

## 4. Realism (non-blocking)

- Real upstream: `json_script_text` (published landing), `js_end_tag_spellings`, `style_raw_text`, `custom_css_script`, `custom_html_script`. Reachable through the two public entry points with plain documents/caller options.
- Injected: `structured_json_serializer` and `combined_data_blocks` read as plausible maintainer optimisations; `combined_data_blocks` is the most task-shaped (a post-pass re-serializer that apparently also touches single blocks), mildly contrived but not planted-looking.
- The foreign-content behaviour the SVG tests rely on is real parser output, confirmed by the nop/oracle runs.

## 5. Verdict

**READY.** A correct fix that follows the primary stated mechanism — re-escape every producer's output so it cannot spell a delimiter — passes every test: oracle 3/3, plus the independent `pass_alternative` and `pass_hardening`. Every test goes through the public API, serializes the product, re-parses it, and asserts the outcome; none demands an error class, status, or bypassed layer. The style/SVG/custom routes are covered literally by "every element whose content the minifier rewrites … no markup may be created from that data". The uncovered JS-in-SVG route and refusal shortcuts are leniency, not unfairness — no correct fix fails. Unfairness reason: none.

GATE_A: READY
NEEDS_HUMAN_REVIEW: NO
