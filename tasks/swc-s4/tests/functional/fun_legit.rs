//! Functional suite: legitimate minification keeps producing the same data and the same
//! program, including values that contain less-than signs and content the minifier combines.

#[path = "support/dom.rs"]
mod dom;

use dom::*;

fn json_block(output: &str) -> serde_json::Value {
    let document = parse_document(output);
    let scripts = script_texts(&document.children);
    assert_eq!(scripts.len(), 1, "one script element: {output}");
    serde_json::from_str(&scripts[0]).expect("script data is valid JSON")
}

#[test]
fn json_values_and_types_are_preserved() {
    let html = r#"<script type="application/json">{
        "text": "1 < 2 and a </b> tag",
        "number": 1.5,
        "whole": 7,
        "flag": true,
        "nothing": null,
        "list": [1, "x<y", false],
        "object": {"nested": "v"}
    }</script>"#;
    let output = minify(html, "{}");
    let value = json_block(&output);
    assert_eq!(value["text"], "1 < 2 and a </b> tag");
    assert_eq!(value["number"], 1.5);
    assert_eq!(value["whole"], 7);
    assert_eq!(value["flag"], true);
    assert!(value["nothing"].is_null());
    assert_eq!(value["list"][1], "x<y");
    assert_eq!(value["object"]["nested"], "v");
}

#[test]
fn json_pretty_output_stays_pretty_and_valid() {
    let html = r#"<script type="application/json">{"alpha":1,"beta":"a<b"}</script>"#;
    let output = minify(html, r#"{"minifyJson":{"pretty":true}}"#);
    let document = parse_document(&output);
    let scripts = script_texts(&document.children);
    assert_eq!(scripts.len(), 1);
    assert!(scripts[0].contains('\n'), "pretty output keeps line breaks: {}", scripts[0]);
    let value: serde_json::Value = serde_json::from_str(&scripts[0]).expect("valid JSON");
    assert_eq!(value["alpha"], 1);
    assert_eq!(value["beta"], "a<b");
}

#[test]
fn javascript_comparisons_and_markup_text_keep_working() {
    let html = r#"<script>var a=1<2;var b="<!--";var c="a<b";window.__ok=c;</script>"#;
    let output = minify(html, "{}");
    let document = parse_document(&output);
    let scripts = script_texts(&document.children);
    assert_eq!(scripts.len(), 1);
    assert!(
        scripts[0].contains("<!--"),
        "a less-than sign inside ordinary program text is not escaped: {}",
        scripts[0]
    );
    assert!(
        scripts[0].contains("a<b"),
        "a less-than sign inside a string is not escaped: {}",
        scripts[0]
    );
    assert!(scripts[0].contains("__ok"), "the program keeps its side effect: {}", scripts[0]);
}

#[test]
fn javascript_end_tag_spelling_inside_source_keeps_working() {
    let html = r#"<script>window.__path="a</b>c";window.__pattern=/a<b/;</script>"#;
    let output = minify(html, "{}");
    let document = parse_document(&output);
    let scripts = script_texts(&document.children);
    assert_eq!(scripts.len(), 1, "one script element: {output}");
    assert!(scripts[0].contains("__path"), "program kept: {}", scripts[0]);
    assert!(scripts[0].contains("</b>") || scripts[0].contains("<\\/b>"), "text kept: {}", scripts[0]);
}

#[test]
fn combined_json_data_blocks_are_combined_and_valid() {
    let html = r#"<script type="application/json">[{"x":1}]</script><script type="application/json">[{"y":2}]</script>"#;
    let output = minify(html, "{}");
    let document = parse_document(&output);
    let scripts = script_texts(&document.children);
    assert_eq!(scripts.len(), 1, "two array blocks are combined: {output}");
    let value: serde_json::Value = serde_json::from_str(&scripts[0]).expect("valid JSON");
    assert_eq!(value[0]["x"], 1);
    assert_eq!(value[1]["y"], 2);
}

#[test]
fn json_object_blocks_are_not_combined() {
    let html = r#"<script type="application/json">{"x":1}</script><script type="application/json">{"y":2}</script>"#;
    let output = minify(html, "{}");
    let document = parse_document(&output);
    let scripts = script_texts(&document.children);
    assert_eq!(scripts.len(), 2, "object blocks stay separate: {output}");
    let first: serde_json::Value = serde_json::from_str(&scripts[0]).expect("valid JSON");
    let second: serde_json::Value = serde_json::from_str(&scripts[1]).expect("valid JSON");
    assert_eq!(first["x"], 1);
    assert_eq!(second["y"], 2);
}

#[test]
fn structured_data_normalization_keeps_meaning() {
    let import_map = r#"<script type="importmap">{"imports":{"alpha":"/a.js","empty":""}}</script>"#;
    let output = minify(import_map, "{}");
    let value = json_block(&output);
    assert_eq!(value["imports"]["alpha"], "/a.js");
    assert!(
        value["imports"].get("empty").is_none(),
        "an empty target is dropped, the other mapping is kept: {}",
        value["imports"]
    );

    let rules = r#"<script type="speculationrules">{"prerender":[{"urls":["/a","/a","/b"]}]}</script>"#;
    let output = minify(rules, "{}");
    let value = json_block(&output);
    assert_eq!(value["prerender"][0]["urls"][0], "/a");
    assert_eq!(value["prerender"][0]["urls"][1], "/b");
}
