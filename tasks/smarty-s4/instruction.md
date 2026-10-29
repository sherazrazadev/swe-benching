# Remote resources can be retrieved from an origin the security policy does not allow

Smarty is a PHP template engine. Applications that let people other than the site's own
developers supply templates turn on its security policy, which includes a list of origins
(scheme and host) that those templates may retrieve remote resources from. The engine is
supposed to retrieve a remote resource only when the origin it lives at is on that list.

We have seen this control bypassed. An untrusted template contained
`{fetch file="https://assets.example.com/notice.txt"}`, where `https://assets.example.com` is
on the site's list of allowed origins. That host answered with a redirect to
`http://10.0.0.5/internal.txt`, an internal address that is not on the list. The engine followed
the redirect and rendered the internal response on the page. The allowed host is not under the
attacker's control; the attacker only chose a path on it that answers with a redirect.

## What must hold

While a security policy declares the origins from which templates may retrieve remote
resources, no such retrieval may come from an origin outside that declaration. A retrieval that
is allowed because the resource's origin is declared must never be diverted to an origin the
policy does not allow: the unapproved origin must not be contacted, and its content must not
appear in, or influence, the rendered result. This holds for every remote resource the engine
retrieves while processing a template.

A refused retrieval must have no effect: the unapproved origin is not contacted and nothing it
provides is rendered or used. The engine may report an error or produce no result.

## What must keep working

Everything that works today keeps working exactly as today:

- With no security policy active, remote resources are still retrieved with today's behaviour,
  including following redirections.
- With a security policy active, a resource whose origin is approved and that answers directly,
  without a redirection, is still retrieved and used exactly as today.
- Local files and the engine's existing handling of them are unchanged.

## Notes

The example above is one example, not the full set of ways the problem can appear. Fix the
underlying problem and its close variants, not only the example.

Do not look up the upstream fix or existing implementations of this protection. Do not
special-case the example. There is no network access.
