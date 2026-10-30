# A shared cache can hand one caller's session cookie to another

## The system

This repository is a general-purpose HTTP client for Node.js. An application can put a response
cache in front of the network: it enables caching on a dispatcher (or installs it globally for
`fetch`), supplies a store, and chooses whether the cache behaves as a **shared** cache (the
default) or a **private** one. A shared cache stands in front of an origin that many callers use;
a private cache belongs to a single user. Cached responses are reused according to their HTTP
freshness information, and the store is a public, replaceable object that an application can
share between differently configured clients.

## Observed impact

An application runs one shared cache in front of an origin whose page answers with a `Set-Cookie`
header. The first caller's request reaches the origin and its response is kept by the cache. A
second, unrelated caller asks for the same URL and is answered from the cache instead of from the
origin; the second caller receives the first caller's `Set-Cookie` header. The second caller's
session is now the first caller's session, and anything the origin personalised for the first
caller is reused for the second.

A harmless way to observe it: request the same URL twice through the same shared cache, where the
origin sets a distinct cookie value on the first response only.

## What must hold

For a cache the client operates in shared mode, over the whole lifetime of a response:

- A response whose header list carries `Set-Cookie` — whatever its value, and however many times
  the field appears — must never be kept by the cache, neither when it first arrives nor when it
  is used to update or replace something the cache already holds.
- That header must never be delivered to a request other than the one whose origin response
  carried it. Nothing already held by the cache may make a later request receive it, whether or
  not that request reaches the origin.
- A response already held by the cache must not be used to answer a request when the origin's
  answer for that request carries `Set-Cookie`.

A cache the client operates in private mode still stores and returns such responses itself.

## Contracts

- When a shared cache may not answer from what it holds, the request is satisfied from the origin
  and the caller receives the origin's own response. The cache must not substitute an unrelated
  error for a request it could satisfy.
- Everything that works today keeps working. Ordinary responses are still stored and reused for
  as long as they are fresh. A private-mode cache itself still stores and returns responses
  carrying `Set-Cookie`. A cache-control directive that names fields still removes exactly those
  named fields from a stored response, and changes no other header.
- A shared cache must leave no entry carrying that header in the store it was given, whatever put
  the entry there.

The values, header names and modes above are examples of how the flaw shows up, not an
exhaustive list; reason about the property, not the samples.

## Constraints

- Fix the problem and its close variants, not just the exact sample above.
- Keep every legitimate use working.
- Do not look up the upstream fix or existing implementations.
- Do not special-case the example inputs.
- There is no network access.
