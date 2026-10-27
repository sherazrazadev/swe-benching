# Compiling a user-supplied document can read files outside the project

## The system
This project compiles MJML, an email markup language, into responsive HTML. A
document can embed another file by referring to it; the compiler reads that file
and inserts its content into the result. The compiler is used two ways: as a
library (a public function that takes a document and options) and as a
command-line tool. Services commonly compile documents that their users submit.

## Observed impact
A service that compiled a document submitted by a user returned, in the rendered
email, the contents of a file that was not part of the service's project. The
submitted document embedded a reference whose target sat outside the project:

```xml
<mjml><mj-body><mj-section><mj-column>
  <mj-include path="../other-service/template.mjml" />
</mj-column></mj-section></mj-body></mjml>
```

Compiling that document from the service's project directory rendered the
embedded file's text into the email. A path that names the target file directly
had the same effect.

## Security property (invariant)
Processing a document must never read, embed or otherwise reproduce a file that
lies outside the directory tree containing that document — for any path written
in the document, for content embedded at any depth, and for every way the
product is asked to process a document. The tree is the one that contains the
document: the directory of the input file, or the directory the caller gives for
the document.

## Contracts the fix must honour
- **Refusal form.** A reference that would leave the tree must be refused
  without the file being opened and without its content being reproduced. Any
  clear error or diagnostic is acceptable; no particular message, exception or
  exit status is required. A refused reference must not stop the rest of the
  document from being processed and rendered.
- **Legitimate use must keep working exactly as today.** In particular:
  - references that stay inside the tree are still followed and their content is
    still rendered, whatever kinds of embedded content the product supports;
  - embedded content may itself embed further content, and a reference written
    inside embedded content is resolved from that content's own location; it
    keeps working as long as it stays inside the tree, including when it points
    to a sibling directory above the embedding file while still inside the tree;
  - a document that embeds nothing renders exactly as it does today.
- A legitimate document may embed several files from nested directories; the
  attack is a reference that resolves outside the tree, not a deeply nested one.

The examples above are illustrations, not the full set of inputs or forms to
handle.

## Constraints
- Fix the problem and its close variants, not only the examples above.
- Keep every legitimate use working.
- Do not special-case the example inputs.
- Do not look up the upstream fix for this issue.
