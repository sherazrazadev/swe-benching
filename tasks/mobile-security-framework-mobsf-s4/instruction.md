# Actions a signed-in user did not intend

MobSF is a self-hosted web application for static and dynamic analysis of mobile apps. A person
signs in, uploads an app, reviews the results, and manages scans, notes and generated reports. The
same installation also serves a JSON API that scripts and CI jobs call with an API key.

## Observed impact

A person who is signed in to the web interface visits an unrelated page. That page submits an
ordinary HTML form to the MobSF installation the person is signed in to. MobSF carries the action
out even though the person never chose it: in one observed case a scan the person owns disappeared
from their list of recent scans and the files belonging to that scan were removed. No confirmation
was shown and no credential was requested.

## The property

A request that another site can cause a signed-in person's browser to send must never create,
change or remove anything the installation stores or manages.

Anything that would change state must instead be requested with a method that a browser does not
use when it merely loads a link, an image or another embedded resource, and that request must carry
the session's anti-forgery token, which a page on another site cannot obtain. This holds for every
action the product offers, through every route and every representation it accepts, however the
request is constructed.

## Contracts

**Refusal.** A request that is not allowed to change anything must receive a client error (a
response in the 400 range) and must leave everything exactly as it was. Nothing may be created,
changed or removed for a request that is refused. A server error is not a refusal.

**Preservation.** Everything that works today keeps working for a signed-in person who uses the
product's own pages, including the anti-forgery token those pages already render and send. In
particular:

- Downloads and other reads that only serve something that already exists must keep working
  without requiring a token.
- Sign-in that completes through a callback posted by an external identity provider must keep
  working.
- Clients that authenticate with an API key instead of a browser session must keep working exactly
  as today, including the published JSON endpoints and their request and response shapes.

The examples above are examples, not the full set.

## Constraints

- Fix the reported problem and all of its close variants; do not special-case the example.
- Keep all legitimate use working.
- Do not look up or copy the upstream fix.
