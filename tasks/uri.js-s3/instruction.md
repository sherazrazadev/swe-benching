# The library and the browser disagree about a link's host

This project is a small JavaScript library for parsing, comparing and rewriting URLs. An
application uses it to read the host a link points at, and to decide whether a link a user
supplied stays on its own site or leads somewhere else.

## What we see

An application asks the library for the host of a user-supplied link before deciding whether to
follow it. For the link

```
https:attacker.example
```

the library reports no host at all, so the application treats the link as a plain path that stays
on its own site and lets it through. When a browser follows the same link it goes to
`attacker.example`. Code that trusts the library's answer therefore steers users to a site the
library said was not there.

## The rule

For any string a caller supplies, the host the library reports — by itself, and when it resolves a
reference from a base — must be the host a standards-compliant browser reaches for that same
string. The same holds whenever the library answers whether a location stays on a given host: it
may never treat a location that a browser sends elsewhere as staying on that host, and it may
never name a host other than the browser's. This is one invariant, not a list of cases; the
spelling above is an example.

## What must not change

- Everything that works today keeps working exactly as today.
- Strings whose scheme names no location — mail addresses, ISBNs and the like — still have no
  host and keep their current path.
- An ordinary web location, a plain relative path or a protocol-relative link keeps the host,
  path, query and fragment it has today.
- When a reference is not absolute, the answer is the one a browser gets resolving that reference
  from the base the library is given.
- A location a browser resolves to the same host keeps being reported as staying on that host,
  however its authority is written.

## Constraints

Fix the problem and its close variants, not just the example. Keep every legitimate use working.
Do not consult the upstream advisory or fix for this issue, and do not special-case the example.
