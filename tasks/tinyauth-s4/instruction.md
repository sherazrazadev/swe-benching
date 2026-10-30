# Per-application access rules can be skipped by spelling the host name differently

Tinyauth is a small authentication gateway that sits in front of self-hosted web
applications behind a reverse proxy. An operator can give each protected
application its own access rule — for example, which signed-in users may pass,
which paths are allowed, and which response headers or basic authentication to
add. When the reverse proxy asks Tinyauth about a requested host, Tinyauth must
apply the rule belonging to that application.

A signed-in user whom an application's rule does not admit can still be let
through to that application merely by asking for it under a differently spelled
host name. For example, with a rule configured for `app.example.com` that admits
only `alice`, a request for `APP.EXAMPLE.COM` from a signed-in user `mallory` is
answered as authenticated and the proxy forwards the request with that user's
identity headers.

The property that must hold: no signed-in user may be let through to an
application whose access rule does not admit them. This must hold however the
application's address is written in the request, and however the rule itself
names the application, including rules that were provided before the request
arrived. A user whom the rule admits must still be let through.

A refusal is an HTTP client error (a 4xx response) that carries no identity
headers (Remote-User, Remote-Name, Remote-Email) and none of the application's
response headers.

Everything that works today must keep working exactly as today. In particular: a
rule that matches an application's configured address keeps applying; a rule
that today applies to an application addressed by its configured short name
keeps applying, including for deeper subdomains; and when both an exact address
match and a short-name match exist, the exact address still wins. Requests that
no rule covers keep following the configured default policy, and the headers or
basic authentication a matching rule adds are unchanged.

The example above is an example, not the full set of affected forms. Fix the
problem and its close variants; keep legitimate use working. There is no network
access. Do not look up an upstream fix or an existing implementation, and do not
special-case the example.
