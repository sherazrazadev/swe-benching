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

/// Builds the text of a CSS hex escape for `<`, the way a stylesheet writes a
/// less-than sign that must not reach the HTML tokenizer.
pub fn escaped_css_lt() -> String {
    format!("{}3c ", char::from(92u8))
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
    texts_of_tag(children, "script")
}

/// The elements with `tag_name` anywhere in the tree, in document order.
pub fn elements_of_tag<'a>(children: &'a [Child], tag_name: &str) -> Vec<&'a Element> {
    let mut found = Vec::new();

    for child in children {
        if let Child::Element(element) = child {
            if &*element.tag_name == tag_name {
                found.push(element);
            }

            found.extend(elements_of_tag(&element.children, tag_name));

            if let Some(content) = &element.content {
                found.extend(elements_of_tag(&content.children, tag_name));
            }
        }
    }

    found
}

/// Decodes the escape sequences a CSS reader applies, so a test can compare the
/// value a stylesheet means to carry rather than its serialized spelling.
pub fn decode_css_escapes(css: &str) -> String {
    let mut out = String::with_capacity(css.len());
    let mut chars = css.chars().peekable();

    while let Some(c) = chars.next() {
        if c != '\\' {
            out.push(c);
            continue;
        }

        match chars.peek() {
            None => out.push('\\'),
            // An escaped newline is a line continuation and is removed.
            Some('\n') | Some('\r') | Some('\u{0C}') => {
                chars.next();
            }
            Some(_) => {
                let mut hex = String::new();

                while hex.len() < 6 {
                    match chars.peek() {
                        Some(ch) if ch.is_ascii_hexdigit() => {
                            hex.push(*ch);
                            chars.next();
                        }
                        _ => break,
                    }
                }

                if hex.is_empty() {
                    out.push(chars.next().unwrap());
                } else {
                    // A single whitespace character terminates a hex escape.
                    if matches!(
                        chars.peek(),
                        Some(' ' | '\t' | '\n' | '\r' | '\u{0C}')
                    ) {
                        chars.next();
                    }

                    let code = u32::from_str_radix(&hex, 16).unwrap_or(0xFFFD);
                    out.push(char::from_u32(code).unwrap_or('\u{FFFD}'));
                }
            }
        }
    }

    out
}

/// The text of every element with the given tag name, in document order, including
/// elements nested in other elements and in template content.
pub fn texts_of_tag(children: &[Child], tag_name: &str) -> Vec<String> {
    let mut found = Vec::new();

    for child in children {
        if let Child::Element(element) = child {
            if &*element.tag_name == tag_name {
                let mut text = String::new();

                for node in &element.children {
                    if let Child::Text(value) = node {
                        text.push_str(&value.data);
                    }
                }

                found.push(text);
            }

            found.extend(texts_of_tag(&element.children, tag_name));

            if let Some(content) = &element.content {
                found.extend(texts_of_tag(&content.children, tag_name));
            }
        }
    }

    found
}
