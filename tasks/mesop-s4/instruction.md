# Security-policy reports can inject terminal control sequences

## System

Mesop serves a web application and tells the browser, through a
Content-Security-Policy, which external resources the application may use. When
the browser blocks a resource it posts a small violation report to the
application, and the application prints a human-readable diagnostic to the
console where the developer is watching, suggesting how to update the policy.

## Observed impact

A violation report whose fields contain terminal escape sequences is printed to
the console exactly as received. A developer watching the server sees the
terminal cleared, recoloured or overwritten, and a crafted value can make the
console show text the attacker chose instead of the diagnostic. Anyone who can
send an HTTP request to the server can do this; no authentication is involved.

One trigger, as a browser would send it:

```
POST /__csp__   Content-Type: application/json

{"csp-report": {
   "document-uri": "https://app.example/\u001b[2J\u001b[Hpage",
   "blocked-uri": "https://cdn.example/lib.js",
   "violated-directive": "connect-src"
}}
```

## Security property

Nothing a client supplies may be written to the console or to the server's log
with terminal escape sequences or control characters intact, no matter how that
value reaches the output. This holds for every value a request carries and for
every diagnostic the application emits about it: cursor and screen control,
colour changes, hyperlink escapes, raw control characters that overwrite or move
text, inserted line breaks, and bidirectional overrides must never survive into
that output.

## Contracts the fix must honor

- **Refusal form.** A request the server rejects because of something the client
  supplied is answered with a client error (a 4xx response) and has no other
  effect. It must not be left to surface as an unhandled server error.
- **Preservation.** A report the server accepts still prints the same
  diagnostic, with its existing wording, symbols, colour and multi-line layout,
  and the policy snippet it suggests still shows the plain address of the
  blocked origin. Everything that works today keeps working exactly as today.
- **Values that are not control data are untouched.** Ordinary report values,
  including percent-encoded and non-ASCII text, come through unchanged.

The example above is one instance, not the full set of ways the property can be
violated.

## Constraints

- Fix the flaw and its close variants, not just the request shown.
- Keep every legitimate use working.
- Do not special-case the example input.
- Do not consult any upstream advisory or fix for this issue.
- There is no network access.
