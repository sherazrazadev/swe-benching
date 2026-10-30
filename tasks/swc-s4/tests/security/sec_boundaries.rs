//! Security suite: script-boundary protection. Every test minifies a document through the
//! crate's public API, serializes it, parses the result again, and asserts that the data that
//! belonged to a script element did not become document markup.

#[path = "support/dom.rs"]
mod dom;

use dom::*;

fn input(html: &str) -> String {
    html.replace("@LT@", &escaped_lt())
}

fn assert_no_injected_element(children: &[swc_html_ast::Child], output: &str) {
    assert!(
        !children_have_id(children, "pwned"),
        "script data must not become document markup; minified output was: {output}"
    );
}

fn assert_single_json_block(output: &str) -> serde_json::Value {
    let document = parse_document(output);
    assert_no_injected_element(&document.children, output);

    let scripts = script_texts(&document.children);
    assert_eq!(
        scripts.len(),
        1,
        "the document must keep one script element; output: {output}"
    );

    serde_json::from_str(&scripts[0])
        .unwrap_or_else(|error| panic!("script data must stay valid JSON ({error}): {}", scripts[0]))
}

#[test]
fn json_application_json_breakout_is_blocked() {
    let html = input(
        r#"<!doctype html><script type="application/json">{"content":"@LT@/script>@LT@img id=pwned>"}</script><p id=after>after</p>"#,
    );
    let output = minify(&html, "{}");
    let value = assert_single_json_block(&output);
    assert_eq!(value["content"], "</script><img id=pwned>");
}

#[test]
fn json_ld_nested_breakout_is_blocked() {
    let html = input(
        r#"<script type="application/ld+json">{"a":{"b":["@LT@/script>@LT@img id=pwned>",2]},"c":true}</script><p id=after>after</p>"#,
    );
    let output = minify(&html, "{}");
    let value = assert_single_json_block(&output);
    assert_eq!(value["a"]["b"][0], "</script><img id=pwned>");
    assert_eq!(value["a"]["b"][1], 2);
    assert_eq!(value["c"], true);
}

#[test]
fn json_import_map_breakout_is_blocked() {
    let html = input(
        r#"<script type="importmap">{"imports":{"target":"@LT@/script>@LT@img id=pwned>"}}</script><p id=after>after</p>"#,
    );
    let output = minify(&html, "{}");
    let value = assert_single_json_block(&output);
    assert_eq!(value["imports"]["target"], "</script><img id=pwned>");
}

#[test]
fn json_speculation_rules_breakout_is_blocked() {
    let html = input(
        r#"<script type="speculationrules">{"prerender":[{"urls":["@LT@/script>@LT@img id=pwned>"]}]}</script><p id=after>after</p>"#,
    );
    let output = minify(&html, "{}");
    let value = assert_single_json_block(&output);
    assert_eq!(
        value["prerender"][0]["urls"][0],
        "</script><img id=pwned>"
    );
}

#[test]
fn json_custom_script_type_breakout_is_blocked() {
    let html = input(
        r#"<script type="text/custom-json">{"content":"@LT@/script>@LT@img id=pwned>"}</script><p id=after>after</p>"#,
    );
    let options = r#"{"minifyAdditionalScriptsContent":[["text/custom-json","json"]]}"#;
    let output = minify(&html, options);
    let value = assert_single_json_block(&output);
    assert_eq!(value["content"], "</script><img id=pwned>");
}

#[test]
fn json_pretty_output_breakout_is_blocked() {
    let html = input(
        r#"<script type="application/json">{"content":"@LT@/script>@LT@img id=pwned>"}</script><p id=after>after</p>"#,
    );
    let output = minify(&html, r#"{"minifyJson":{"pretty":true}}"#);
    let value = assert_single_json_block(&output);
    assert_eq!(value["content"], "</script><img id=pwned>");
}

#[test]
fn json_svg_namespace_breakout_is_blocked() {
    let html = input(
        r#"<svg><script type="application/json">{"content":"@LT@/script>@LT@img id=pwned>"}</script></svg><p id=after>after</p>"#,
    );
    let output = minify(&html, "{}");
    let value = assert_single_json_block(&output);
    assert_eq!(value["content"], "</script><img id=pwned>");
}

#[test]
fn json_template_content_breakout_is_blocked() {
    let html = input(
        r#"<template><script type="application/json">{"content":"@LT@/script>@LT@img id=pwned>"}</script></template><p id=after>after</p>"#,
    );
    let output = minify(&html, "{}");
    let document = parse_document(&output);
    assert_no_injected_element(&document.children, &output);
    let scripts = script_texts(&document.children);
    assert_eq!(scripts.len(), 1, "one script element is kept: {output}");
    let value: serde_json::Value = serde_json::from_str(&scripts[0]).expect("valid JSON");
    assert_eq!(value["content"], "</script><img id=pwned>");
}

#[test]
fn json_document_fragment_breakout_is_blocked() {
    let html = input(
        r#"<script type="application/json">{"content":"@LT@/script>@LT@img id=pwned>"}</script><p id=after>after</p>"#,
    );
    let output = minify_fragment(&html, "{}");
    let context = context_element();
    let fragment = parse_fragment(&output, &context);
    assert_no_injected_element(&fragment.children, &output);
    let scripts = script_texts(&fragment.children);
    assert_eq!(scripts.len(), 1, "one script element is kept: {output}");
    let value: serde_json::Value = serde_json::from_str(&scripts[0]).expect("valid JSON");
    assert_eq!(value["content"], "</script><img id=pwned>");
}

#[test]
fn json_combined_data_blocks_breakout_is_blocked() {
    let html = input(
        r#"<script type="application/json">[{"content":"@LT@/script>@LT@img id=pwned>"}]</script><script type="application/json">[{"other":2}]</script><p id=after>after</p>"#,
    );
    let output = minify(&html, "{}");
    let document = parse_document(&output);
    assert_no_injected_element(&document.children, &output);
    let scripts = script_texts(&document.children);
    assert_eq!(scripts.len(), 1, "combined data blocks stay combined: {output}");
    let value: serde_json::Value = serde_json::from_str(&scripts[0]).expect("valid JSON");
    assert_eq!(value[0]["content"], "</script><img id=pwned>");
    assert_eq!(value[1]["other"], 2);
}

fn assert_javascript_kept(output: &str) {
    let document = parse_document(output);
    assert_no_injected_element(&document.children, output);
    let scripts = script_texts(&document.children);
    assert_eq!(scripts.len(), 1, "one script element is kept: {output}");
    assert!(
        scripts[0].contains("__marker"),
        "the minified program still contains its side effect: {}",
        scripts[0]
    );
}

#[test]
fn js_uppercase_end_tag_breakout_is_blocked() {
    let html = input(
        r#"<script>window.__marker="@LT@/SCRIPT>@LT@img id=pwned>";</script><p id=after>after</p>"#,
    );
    let output = minify(&html, "{}");
    assert_javascript_kept(&output);
}

#[test]
fn js_whitespace_end_tag_breakout_is_blocked() {
    let html = input(
        r#"<script>window.__marker="@LT@/script >@LT@img id=pwned>";</script><p id=after>after</p>"#,
    );
    let output = minify(&html, "{}");
    assert_javascript_kept(&output);
}

#[test]
fn js_module_uppercase_end_tag_breakout_is_blocked() {
    let html = input(
        r#"<script type="module">window.__marker="@LT@/SCRIPT>@LT@img id=pwned>";</script><p id=after>after</p>"#,
    );
    let output = minify(&html, "{}");
    assert_javascript_kept(&output);
}

/// True when `text` contains `</name` followed by a character that ends an HTML
/// end tag the way a browser reads it: `>`, `/` or whitespace.
fn contains_end_tag(text: &str, name: &str) -> bool {
    let lower = text.to_ascii_lowercase();
    let bytes = lower.as_bytes();
    let tag = name.as_bytes();
    let end = 2 + tag.len();

    if bytes.len() < end {
        return false;
    }

    (0..=bytes.len() - end).any(|index| {
        bytes[index] == b'<'
            && bytes[index + 1] == b'/'
            && &bytes[index + 2..index + end] == tag
            && matches!(
                bytes.get(index + end),
                Some(b'>' | b'/' | b' ' | b'\t' | b'\n' | b'\x0C' | b'\r')
            )
    })
}

fn assert_stylesheet_kept(output: &str) -> String {
    let document = parse_document(output);
    assert_no_injected_element(&document.children, output);
    let styles = texts_of_tag(&document.children, "style");
    assert_eq!(
        styles.len(),
        1,
        "the document must keep one style element; output: {output}"
    );
    let stylesheet = styles[0].clone();
    assert!(
        !contains_end_tag(&stylesheet, "style"),
        "the stylesheet must not contain a literal end tag; output: {output}"
    );
    assert!(
        stylesheet.contains("pwned"),
        "the data must stay in the element; output: {output}"
    );

    stylesheet
}

#[test]
fn style_string_escape_breakout_is_blocked() {
    let html = format!(
        r#"<style>a{{content:"{}/style><img id=pwned>"}}</style><p id=after>after</p>"#,
        escaped_css_lt()
    );
    let output = minify(&html, "{}");
    let stylesheet = assert_stylesheet_kept(&output);
    assert!(
        stylesheet.contains("content"),
        "the rule must be kept; output: {output}"
    );
}

#[test]
fn style_url_escape_breakout_is_blocked() {
    let html = format!(
        r#"<style>a{{background:url("{}/style><img id=pwned>")}}</style><p id=after>after</p>"#,
        escaped_css_lt()
    );
    let output = minify(&html, "{}");
    let stylesheet = assert_stylesheet_kept(&output);
    assert!(
        stylesheet.contains("background"),
        "the declaration must be kept; output: {output}"
    );
}

#[test]
fn style_svg_namespace_breakout_is_blocked() {
    // In foreign content the element's text is parsed with character references and
    // as markup, so the serializer is free to spell the text with entities. What
    // matters is the structure and the value the stylesheet ends up carrying.
    let html = r#"<svg><style>a{content:"&lt;/style&gt;&lt;img id=pwned&gt;"}</style></svg><p id=after>after</p>"#;
    let output = minify(html, "{}");
    let document = parse_document(&output);
    assert_no_injected_element(&document.children, &output);

    let svgs = elements_of_tag(&document.children, "svg");
    assert_eq!(svgs.len(), 1, "the svg element is kept: {output}");
    let styles = texts_of_tag(&svgs[0].children, "style");
    assert_eq!(
        styles.len(),
        1,
        "exactly one style element stays inside the svg: {output}"
    );
    assert_eq!(
        decode_css_escapes(&styles[0]),
        r#"a{content:"</style><img id=pwned>"}"#,
        "the stylesheet keeps the value it carried, inside its element: {output}"
    );
    assert!(
        children_have_id(&document.children, "after")
            && !children_have_id(&svgs[0].children, "after"),
        "the paragraph after the svg stays outside it: {output}"
    );
}

#[test]
fn custom_css_script_breakout_is_blocked() {
    let html = format!(
        r#"<script type="text/x-css">a{{content:"{}/script><img id=pwned>"}}</script><p id=after>after</p>"#,
        escaped_css_lt()
    );
    let options = r#"{"minifyAdditionalScriptsContent":[["text/x-css","css"]]}"#;
    let output = minify(&html, options);
    let document = parse_document(&output);
    assert_no_injected_element(&document.children, &output);
    let scripts = script_texts(&document.children);
    assert_eq!(
        scripts.len(),
        1,
        "the document must keep one script element; output: {output}"
    );
    assert!(
        !contains_end_tag(&scripts[0], "script"),
        "the script's data must not contain a literal end tag; output: {output}"
    );
    assert!(
        scripts[0].contains("pwned"),
        "the data must stay in the element; output: {output}"
    );
}

#[test]
fn custom_html_script_breakout_is_blocked() {
    let html = r#"<script type="text/x-template"><p title="&lt;/script&gt;&lt;img id=pwned&gt;">x</p></script><p id=after>after</p>"#;
    let options = r#"{"minifyAdditionalScriptsContent":[["text/x-template","html"]]}"#;
    let output = minify(html, options);
    let document = parse_document(&output);
    assert_no_injected_element(&document.children, &output);
    let scripts = script_texts(&document.children);
    assert_eq!(
        scripts.len(),
        1,
        "the document must keep one script element; output: {output}"
    );
    assert!(
        !contains_end_tag(&scripts[0], "script"),
        "the script's data must not contain a literal end tag; output: {output}"
    );
    assert!(
        scripts[0].contains("pwned"),
        "the data must stay in the element; output: {output}"
    );
}
