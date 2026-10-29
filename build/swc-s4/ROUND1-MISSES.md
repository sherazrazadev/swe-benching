# Round 1 trial evidence: swc-s4

Which hidden tests each graded round-1 run FAILED.

| Run | Reward | Failed tests |
|---|---|---|
| deepseek-r1 | 0.9231 | security 1/13: json_svg_namespace_breakout_is_blocked |
| deepseek-r2 | 0.9231 | security 1/13: json_svg_namespace_breakout_is_blocked |
| deepseek-r3 | 0.0 | functional 1/293: javascript_comparisons_and_markup_text_keep_working |
| mimo-r1 | 0.0 | functional 3/259: test_minify_document_tests__fixture__element__script_raw_text_json_escape__input_html, test_minify_document_tests__fixture__element__script_raw_text_json_pretty__input_html, test_minify_document_tests__fixture__element__script_raw_text_ld_json__input_html |
| mimo-r2 | 0.0 | security 13/13: js_module_uppercase_end_tag_breakout_is_blocked, js_uppercase_end_tag_breakout_is_blocked, js_whitespace_end_tag_breakout_is_blocked, json_application_json_breakout_is_blocked, json_combined_data_blocks_breakout_is_blocked, json_custom_script_type_breakout_is_blocked, json_document_fragment_breakout_is_blocked, json_import_map_breakout_is_blocked, json_ld_nested_breakout_is_blocked, json_pretty_output_breakout_is_blocked, json_speculation_rules_breakout_is_blocked, json_svg_namespace_breakout_is_blocked, json_template_content_breakout_is_blocked |
| mimo-r3 | 1.0 | none (solved) |

Keep the traps the model that failed every run keeps missing; add 2-3 new real traps of the kinds common/builder/BRIEF-trap-stack.md lists for the model that solved it.
