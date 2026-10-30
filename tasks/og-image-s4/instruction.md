A Nuxt site can generate its social-preview (Open Graph) images on demand. A page author calls the
module's composable with a component and props; the module builds a special URL, and when a crawler
requests it the server renders a PNG with a headless renderer. The URL also carries renderer
options, including a list of additional font faces to load before drawing text.

That list is decoded straight out of the request path. In a test deployment, a request whose font
entry named a service bound to the machine's loopback interface made the server fetch that service
and hand the bytes back as if they were font data. An unauthenticated visitor can therefore make the
server issue requests to hosts it must never reach, including internal services and cloud metadata
endpoints.

## Required behaviour

Whatever font data a visitor can make the renderer load, the server must never contact a host other
than the origin serving the image request. No value a visitor supplies in a font entry may cause a
request to any other host — internal or external — however that value is written, however it
reaches the renderer, and whatever the origin serving the request does in response.

Inline font data (a `data:` URI) is not a network target. It must be decoded and used without any
outbound request.

## Contracts

- Refusing a font is a soft outcome: the font is treated as unavailable and the server must not
  contact the other host. The image request must not be made to fail merely because a font was
  refused.
- Everything that works today keeps working exactly as today. In particular:
  - a font served from the site's own origin by an ordinary relative path still loads, including
    when the application is reached through a loopback address in development or behind a proxy;
  - a font supplied inline as a `data:` URI still loads and renders;
  - ordinary image generation is otherwise unchanged.
- The invariant applies to every way the module can deliver an image; it is not limited to the
  setup in the example.
- The example above is one example, not the full set of forms a font entry can take.

## Constraints

- Fix the problem and its close variants, not only the example.
- Keep legitimate use working.
- Do not look up the upstream fix.
- Do not special-case the example (its host, path or value).
- There is no network access.
