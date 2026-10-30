# Minified HTML can end a script element early

swc's HTML minifier (the `swc_html_minifier` Rust library, used by the `@swc/html` package and its
Node and WebAssembly bindings) parses an HTML document, rewrites the text of the elements whose
content it minifies, and serializes the document again. Applications minify pages with it before
serving them to a browser. The two public entry points, `minify_document` and
`minify_document_fragment`, rewrite the tree in place.

A page that had been minified was served with one script element's data ending in the middle: the
browser read the remainder of that data as markup, and an element that had never been in the page
appeared in its place. The same data left unminified stayed inside the script element. The data had
been written into the document in an escaped form, and minification turned the escaped bytes back
into the characters a browser uses to delimit the element. Reproducing it needed only a document
whose script data had been written with a unicode escape for `<`: minifying that page and serving
the result was enough.

**Invariant.** After minification, no value carried by the document and no data the minifier
produces from it may end the element that holds it: when the serialized document is parsed again,
every element whose content the minifier rewrites must still be that element, the data the minifier
put in it must stay in it and decode to the values the minifier meant to write, and no markup may
be created from that data. This holds for every such element — whatever kind of content it holds,
whatever options the caller passes, wherever in the document or fragment it sits, and however that
content was produced or re-produced along the way. The case above is one example, not the full set.

**Contracts.**

- The serialized document is the product. Parsing it again must give the same element boundaries
  and the same data the minifier produced, with no element created from text that belonged to a
  minified element.
- Data that minification keeps must keep its meaning: text stays text, numbers stay numbers,
  booleans and nulls stay themselves, and object and array shape is preserved; data written in
  escaped form decodes to the same value as before; pretty output stays pretty; and content
  written in a syntax the minifier understands keeps the same effect after minification. A
  minifier that changes legitimate data, or that escapes characters in ordinary program text so
  that it no longer does what it did, is a regression.
- Everything that works today keeps working: a legitimate document must minify to the same output
  as today apart from the escaping this problem requires, and its data and its program must keep
  their meaning.

Fix the problem and its close variants; keep legitimate use working; do not look up the upstream
fix; do not special-case the example.
