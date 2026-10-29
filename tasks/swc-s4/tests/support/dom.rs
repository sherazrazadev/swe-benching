//! Shared helpers for the hidden suites: parse, minify, serialize, and inspect the
//! resulting document. Everything goes through the crate's public API.

use swc_atoms::atom;
use swc_common::{sync::Lrc, FileName, FilePathMapping, SourceMap, GLOBALS};
use swc_html_ast::{Child, Document, DocumentFragment, Element, Namespace};
use swc_html_codegen::{
    writer::basic::{BasicHtmlWriter, BasicHtmlWriterConfig},
    CodeGenerator, CodegenConfig, Emit,
};
use swc_html_minifier::{
    minify_document, minify_document_fragment,
    option::{CssOptions, MinifyOptions},
};
use swc_html_parser::{parse_file_as_document, parse_file_as_document_fragment};

pub fn options(json: &str) -> MinifyOptions<CssOptions> {
    serde_json::from_str(json).expect("valid minifier options")
}

/// Builds the text of a JSON unicode escape for `<`, the way a producer writes a
/// less-than sign that must not reach the HTML tokenizer.
pub fn escaped_lt() -> String {
    format!("{}u003C", char::from(92u8))
}

pub fn context_element() -> Element {
    Element {
        span: Default::default(),
        tag_name: atom!("template"),
        namespace: Namespace::HTML,
        attributes: Vec::new(),
        children: Vec::new(),
        content: None,
        is_self_closing: false,
    }
}

pub fn parse_document(html: &str) -> Document {
    let cm = Lrc::new(SourceMap::new(FilePathMapping::empty()));
    let fm = cm.new_source_file(FileName::Anon.into(), html.to_string());
    let mut errors = Vec::new();
    parse_file_as_document(&fm, Default::default(), &mut errors).expect("document parses")
}

pub fn parse_fragment(html: &str, context: &Element) -> DocumentFragment {
    let cm = Lrc::new(SourceMap::new(FilePathMapping::empty()));
    let fm = cm.new_source_file(FileName::Anon.into(), html.to_string());
    let mut errors = Vec::new();
    parse_file_as_document_fragment(
        &fm,
        context,
        swc_html_ast::DocumentMode::NoQuirks,
        None,
        Default::default(),
        &mut errors,
    )
    .expect("fragment parses")
}

pub fn serialize_document(document: &Document) -> String {
    let mut out = String::new();
    let writer = BasicHtmlWriter::new(&mut out, None, BasicHtmlWriterConfig::default());
    let mut generator = CodeGenerator::new(
        writer,
        CodegenConfig {
            scripting_enabled: false,
            minify: true,
            ..Default::default()
        },
    );
    generator.emit(document).expect("document serializes");
    out
}

pub fn serialize_fragment(fragment: &DocumentFragment) -> String {
    let mut out = String::new();
    let writer = BasicHtmlWriter::new(&mut out, None, BasicHtmlWriterConfig::default());
    let mut generator = CodeGenerator::new(
        writer,
        CodegenConfig {
            scripting_enabled: false,
            minify: true,
            ..Default::default()
        },
    );
    generator.emit(fragment).expect("fragment serializes");
    out
}

/// Parses, minifies and serializes a document, the way an application uses the library.
pub fn minify(html: &str, options_json: &str) -> String {
    GLOBALS.set(&Default::default(), || {
        let mut document = parse_document(html);
        minify_document(&mut document, &options(options_json));
        serialize_document(&document)
    })
}

pub fn minify_fragment(html: &str, options_json: &str) -> String {
    GLOBALS.set(&Default::default(), || {
        let context = context_element();
        let mut fragment = parse_fragment(html, &context);
        minify_document_fragment(&mut fragment, &context, &options(options_json));
        serialize_fragment(&fragment)
    })
}

pub fn children_have_id(children: &[Child], id: &str) -> bool {
    for child in children {
        if let Child::Element(element) = child {
            if element
                .attributes
                .iter()
                .any(|attribute| &*attribute.name == "id" && attribute.value.as_deref() == Some(id))
            {
                return true;
            }

            if children_have_id(&element.children, id) {
                return true;
            }

            if let Some(content) = &element.content {
                if children_have_id(&content.children, id) {
                    return true;
                }
            }
        }
    }

    false
}

pub fn script_texts(children: &[Child]) -> Vec<String> {
    let mut found = Vec::new();

    for child in children {
        if let Child::Element(element) = child {
            if &*element.tag_name == "script" {
                let mut text = String::new();

                for node in &element.children {
                    if let Child::Text(value) = node {
                        text.push_str(&value.data);
                    }
                }

                found.push(text);
            }

            found.extend(script_texts(&element.children));

            if let Some(content) = &element.content {
                found.extend(script_texts(&content.children));
            }
        }
    }

    found
}
