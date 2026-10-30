# Redirects built from route parameters

This package is the routing and HTTP layer of a Node.js web framework. Applications register
routes and the library generates URLs for them: links rendered into pages, and redirects whose
`Location` header moves the browser to the next page. The values that fill a route's parameters
usually come from the request — a page id, a slug, a file name, a return path.

## What happens today

An application redirects to a route whose parameter is filled from the query string:

```
GET /login?next=/evil.example.com
```

The handler builds the target with the library and sends the browser there, passing the value of
`next` as the value of the page parameter. The response is a `Location` header of
`//evil.example.com`, so the browser leaves the site for a host the application never chose.

## What must be true

Any value used to fill a route parameter is data. It must stay inside the single path segment it
fills in every URL this library generates from route parameters, and it must never add a path
separator, a backslash, a query or fragment delimiter, or in any other way change the path
structure, authority or scheme of the generated URL — whatever form the value takes and whichever
API of the library produces the URL.

A list of values fills consecutive segments, and each element of that list is confined to the
single segment it fills.

## Contracts

- Building a URL must keep succeeding for every value it is given. A value is carried in the URL;
  it is not a reason to refuse the call or to fail a request.
- Everything that works today must keep working exactly as today. A value made of letters, digits,
  `.`, `-` and `_` produces the same URL as before. A prefix supplied for the URL and a query
  string supplied for the URL are structure rather than parameter values and must be reproduced
  unchanged. A list of three ordinary values still fills three segments.
- The example above is one example, not the full set of forms a value can arrive in.

## Constraints

- Fix the problem and its close variants. Do not special-case the example above.
- Keep legitimate use of the library working.
- Do not look up the upstream fix.
