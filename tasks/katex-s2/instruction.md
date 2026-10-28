# KaTeX emits attacker-chosen links when a page's object prototype is polluted

KaTeX is a JavaScript library that typesets LaTeX in web pages and in server-side rendering. A
page hands it the LaTeX source and a small options object: how the result should be displayed,
whether the input is trusted, and so on. By default the library refuses commands that could emit
active HTML — links, images and the HTML-attribute commands — unless the page opts in through its
trust option.

## Impact

A page renders visitor-supplied LaTeX with KaTeX and also loads an unrelated library that has a
prototype-pollution bug. A visitor plants `trust: true` on JavaScript's shared object prototype and
then submits

```latex
\href{javascript:alert(document.cookie)}{click me}
```

KaTeX reads the inherited value, treats the input as trusted, and emits a real `<a>` element whose
`href` is the `javascript:` URL, even though the page never enabled trust and never asked for a
link.

## What must hold

Only the caller's own entries and KaTeX's own definitions may decide a render. A value that exists
only on JavaScript's shared object prototype must never change what a render emits, which commands
it permits, or the data on which that permission decision is made — however the value reaches the
decision.

That single rule covers the options a caller passes, the defaults the renderer supplies for an
option that was not given, the names a render may expand as macros, and the information a trust
setting is shown. A macro name is a definition only when KaTeX or the current render defines it. A
permission decision looks only at the command's own data.

## Contracts

- When an input is refused, the refused effect must not appear in the output: no link, image source
  or HTML attribute derived from it. Refusing by rendering the command as unsupported is fine, and
  a thrown error is fine, as long as nothing was emitted and no side effect occurred.
- Everything that works today keeps working exactly as today. Values the renderer currently accepts
  without asking for trust stay accepted, and a trust setting supplied as a boolean or as a
  function keeps deciding as it does today.
- The example above is one example, not the full set of ways the problem can show up. Fix the
  problem and its close variants; do not special-case the example.
- Do not look up the upstream fix for this issue.
