# The Quasar development error page exposes the machine and lets request data run

## System

Quasar CLI serves a developer error page when a server-rendered page fails while the
application is running in development. The page is an HTML document. The server embeds,
inside the page's own script, a data block describing the failed request, the error and
its stack, and the request's headers and cookies. The developer opens that page in a
browser, usually on the machine that is running the development server.

## Observed impact

While an application runs in SSR development mode, make a page render fail. Every value
that arrived with the request is embedded in the returned document, and the document also
lists the environment of the machine that served it. A request whose header value
contains `</ScRiPt>` is returned as a live element rather than text, so opening the page
runs whatever the sender put there. Anyone who can reach the development server can
therefore act in the developer's browser. One such request is enough.

## Properties that must hold

- No value that arrives with the request, or that the page derives from such a value, may
  become part of the document the browser parses. It may only be carried as inert data or
  shown as text, never as a document node or anything the browser acts on, however the
  value reaches the page.
- The server process's environment must never be disclosed by the page: no environment
  variable name and no environment variable value may appear in it, in any form.

Both properties cover the page as a whole, including everything the page already
carried before this change.

## Contracts the fix must honour

- The page is still produced for every failing request, with its usual headers, and it
  still displays the information it displays today. Nothing that works today may stop
  working, and no part of the page may be removed to make the problem go away.
- Legitimate values keep displaying exactly as they are. This includes values containing
  markup characters, quotes, ampersands and line separators, a literal closing-tag
  lookalike inside displayed source text, and cookie values containing `=`, spaces or
  percent-encoded characters.
- A value that is unusual but harmless must render normally: the page must not fail,
  truncate it or replace its characters.

The example above is one instance, not the full set of ways the properties can be
violated. Fix the problem and its close variants. Keep legitimate use working. Do not
special-case the example, and do not look up the published fix.
