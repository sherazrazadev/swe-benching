# Static-site generation writes files outside its output directory

The framework includes a static-site generation helper. It renders an application's GET routes in
process and writes each response to a file inside an output directory chosen by the caller. Build
pipelines run it over content they did not author, including route addresses assembled from that
content.

## Observed impact

An application with a dynamic route `/:id` whose generated parameters include `a/b/../../../pwned`
is rendered with the output directory `./static`. The helper writes a page at
`<working directory>/pwned.txt`, outside `./static`, and reports success.

## Required behaviour

- No file the static-site generator produces may be created, changed or removed outside the output
  directory it was given.
- That holds for every value other than the output directory itself that the application or its
  content supplies to name a produced file or choose its location, and however that value reaches
  the generator.
- The boundary is the output directory the generator was given. Any location that is not inside it
  counts as outside, whatever it contains.
- A refused generation reports failure: the call either throws, or completes with an unsuccessful
  result. Nothing outside the output directory may be created, changed or removed, including
  anything the generator did before it refused.

The example above is one example, not the full set.

## Must keep working exactly as today

- Rendering applications with fixed and generated routes, including nested routes and nested
  subdirectories inside the output directory.
- Output directories given as a relative path, an absolute path, a parent path, a path with
  redundant leading separators, or a Windows-style root: generation into each still succeeds, and
  its files stay under that directory.
- Every other use of the helper that stays inside its output directory, including legitimate values
  next to an escaping one, and the existing form and contents of the files it writes.
- The existing behaviour of the project for everything it writes.

## Constraints

- Fix the problem and its close variants, not only the example above.
- Keep legitimate use working.
- Do not look up the upstream fix.
- Do not special-case the example.
