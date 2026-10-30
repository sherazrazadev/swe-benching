# Built-in test support must be off unless an operator turns it on

## What this is

This repository is Appium, a Node.js server for mobile test automation. Drivers and plugins add
endpoints to one HTTP server, which also ships a small amount of built-in support that exists only
to help driver authors exercise a live server: a few built-in pages, some sample files, and
endpoints that deliberately fail so that error handling can be tried out.

## What was observed

A freshly started Appium server answers requests to that built-in support for anyone who can reach
it. On one of the built-in pages, an ordinary request whose query value contains HTML markup comes
back with that markup placed unescaped inside a script block, so a browser runs it. No operator
action is needed to expose the support.

## Required behaviour

- The server must not expose its built-in test and debugging support to a client unless the
  operator has explicitly turned that support on. This covers every part of the support the server
  ships — the built-in test pages, the sample and fixture files it ships for testing, and the
  deliberate error triggers — and it holds whatever HTTP method a request uses and wherever in the
  library the exposure is set up.
- While the support is off, a request for it must be refused as a client error, with no side
  effect, and must not return any of that material.
- The operator's switch is the environment variable `APPIUM_ENABLE_LEGACY_TEST_PAGES`. The support
  is on when the variable's value is `1`, `true` or `yes`, in any letter case. Any other value —
  including `0`, `false`, `no`, an empty value, or no value at all — leaves it off. The variable is
  read when a server is started.
- While the support is on it must behave exactly as it does today. In particular, a value submitted
  to one of the built-in pages is bound into the returned document unchanged, the pages' cookies and
  delay handling are unchanged, the sample files are served, and the deliberate error triggers still
  produce their errors.
- Everything else the server does keeps working exactly as today: ordinary driver endpoints, the
  base-path setting, and the client-error response for an unknown path.

These examples are examples, not a complete list of the ways the requirement can be violated.

## Constraints

- Fix the problem and its close variants.
- Keep legitimate use working.
- Do not look up the upstream fix or existing implementations.
- Do not special-case the examples.
- There is no network access.
