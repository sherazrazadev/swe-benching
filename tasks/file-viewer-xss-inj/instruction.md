# Crafted Word documents can run script in the viewer page

The project is a browser-side file viewer. One renderer previews legacy Microsoft Word documents: it reads the binary document, builds markup for links, pictures, embedded files and formatted paragraphs, and puts that markup into the page — through the viewer helper, the worker-backed path, and the Word renderer plugin the standard component uses. Documents are untrusted: people open files they received from elsewhere.

Opening a crafted document is enough to run script in the viewer's origin. A hostile link destination, picture reference, embedded file, or formatting value ends up in the generated markup, and the page executes it with the viewer's privileges. The same document content must not become active when it is printed or exported.

## Required behaviour

- No value taken from a document may become a script-capable or local-file destination in anything the library generates, mounts, prints or exports. This applies wherever a document value supplies a link, including link text, pictures, linked pictures, embedded files and their download links.
- No value taken from a document may break out of the attribute or CSS declaration it is written into, or add an event handler, in anything the library generates, mounts, prints or exports. This applies to formatting names and labels as well as displayed text.
- External navigation from a document is opt-in. Expose a public render option named `externalLinkPolicy` that accepts `"block"` or `"allow"`, defaults to `"block"`, and is honoured by every rendering path, including the Word renderer plugin. Under `"allow"`, ordinary web, mail and telephone destinations and relative paths remain usable; script-capable and local-file destinations never are. Under the default `"block"`, only destinations inside the document, such as bookmarks, remain active.
- Embedded files stay downloadable when they are ordinary assets. A content type a browser can execute as a document — markup, script, XML-based documents, SVG — must never be offered as a link. Ordinary inline images must keep displaying.
- Ordinary behaviour must be preserved: font names, style names, pictures and linked pictures, downloadable attachments and internal bookmarks keep working exactly as they do today, and print and export keep the same content with only unsafe destinations removed.

The document binary is the usual source of these values, but callers may also hand the renderer an already-parsed document or go through the worker-backed path; the same guarantees apply to those routes.

## Constraints

Fix the reported problem and its close variants. Keep all existing legitimate behaviour working. Leave the project's own checks and fixtures unchanged. Do not look up the upstream fix, and do not special-case the examples above.
