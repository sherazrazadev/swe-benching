# KaTeX can emit attacker-chosen links when JavaScript's shared prototype is polluted

KaTeX is a JavaScript library that typesets LaTeX in web pages and in server-side rendering. A page
gives it the LaTeX source and a small options object: how the result should be displayed, which
input is trusted, which macros are defined, and so on. Commands that could load a resource or set
an HTML attribute — links such as `\href` and `\url`, images, and the HTML-attribute commands — are
refused unless the page opts in through its trust setting.

## Impact

A page renders visitor-supplied LaTeX with KaTeX and also loads an unrelated library that has a
prototype-pollution bug. A visitor plants `trust: true` on JavaScript's shared object prototype and
then submits

```latex
\href{javascript:alert(document.cookie)}{click me}
```

KaTeX treats the input as trusted and emits a real `<a>` element whose `href` is the `javascript:`
URL, even though the page never enabled trust and never asked for a link.

## What must hold

What the library renders, and what it permits, must be determined only by the caller's own entries
in the options object it was given and by the library's own built-in defaults. A value that exists
only on JavaScript's shared object prototype must have no effect: it must never make input trusted
and must never change the rendered result.

A name is a definition only when the library itself defines it or the current render defines it. A
name that exists only on the shared object prototype is not a definition.

## Contracts

- When something is refused, nothing derived from it may appear in the output: no link, image
  source, event handler or other attribute. Rendering the construct as unsupported is a valid
  refusal, and throwing is a valid refusal, as long as nothing was emitted and no side effect
  occurred.
- Everything that works today keeps working exactly as today. In particular, an option the caller
  sets itself keeps its meaning whether its value is a boolean, a string, a function or a map of
  entries; an option explicitly set to `undefined` still falls back to the default; a caller's own
  definitions, delimiters and attribute choices keep working; and a page that enables trust still
  gets the same links and images it gets today.
- The example above is one example, not the full set of ways the problem can show up. Fix the
  problem and its close variants; do not special-case the example.
- Do not look up the upstream fix for this issue.
