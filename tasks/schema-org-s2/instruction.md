# schema-org: structured data must stay inside its script block

`spatie/schema-org` is a PHP library that builds schema.org structured data and renders it as an
`application/ld+json` script block for a page. An application feeds it values from its own data —
product names, descriptions, identifiers, URLs — and echoes the rendered block into the HTML it
serves.

## What we saw

A storefront renders a product whose name comes from a supplier feed. The supplier set the name to:

    </script><script>alert(document.cookie)</script>

The page echoed the product's rendered block and the browser executed the second script: the feed
value had escaped the `ld+json` element and become page script.

## What must be true

No value the application passes to this package may be able to end, escape or split the `ld+json`
script element it is rendered into, or start a new element — wherever in the emitted markup that
value appears. The rendered fragment must always be exactly one script element, its body must be
valid JSON, and parsing the page must give back exactly the values the application set.

This holds for every way the package renders a script block, and every route by which a value can
reach one.

## Contracts

- A value the application sets must be rendered and must survive unchanged: whatever parses the
  emitted page reads back exactly that value.
- Everything that works today keeps working exactly as today. Converting a type to an array or to
  a plain JSON string keeps returning raw values — `<`, `>`, `&`, quotes, slashes and non-ASCII
  characters are not escaped there — and the rendered script body keeps its current formatting
  (slashes and non-ASCII characters stay readable) and stays valid JSON.
- The example above is an example, not the full set of ways this can happen.

## Ground rules

Fix the problem and its close variants. Keep legitimate use working. Do not look up the upstream
fix or the advisory. Do not special-case the example.
