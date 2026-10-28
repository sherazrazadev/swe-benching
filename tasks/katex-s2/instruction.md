# KaTeX must render and permit only from what its caller supplies or it defines itself

KaTeX is a JavaScript library that typesets LaTeX in web pages and in server-side rendering. It
receives the source to render together with caller-supplied configuration, and it produces markup
from that input and from the library's own definitions and built-in defaults.

## Impact

A page renders visitor-supplied LaTeX with KaTeX while also loading an unrelated library that has a
prototype-pollution bug. A visitor plants an entry on JavaScript's shared object prototype. If that
entry can influence what KaTeX renders or permits, the visitor can make the page emit content the
page never supplied, or make KaTeX accept something the page never allowed.

## What must hold

Nothing reachable only through JavaScript's shared object prototype may supply, replace or extend
the data the library uses to decide what it renders or permits. Every such value must come from the
caller's own input to the library or from the library's own definitions and built-in defaults; a
definition that exists only on the shared object prototype is not a definition the library may use.

## Contracts

- When the library refuses input, nothing derived from it may reach the output and no side effect may
  occur; rendering the construct as unsupported and throwing are both valid refusals.
- Everything that works today keeps working exactly as today. Caller-supplied configuration and
  caller-supplied definitions keep their meaning in whatever form the caller provides them, including
  an entry the caller explicitly leaves unset, which still falls back to the library's own default;
  and a caller that deliberately permits something still gets the same result it gets today.
- A fix that special-cases one observed form rather than establishing the property is not enough;
  the property must hold for every way the library consumes caller input and its own definitions.
- Do not look up the upstream fix for this issue.
