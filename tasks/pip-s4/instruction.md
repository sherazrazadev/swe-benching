# Package files escape the directory they are saved into

## The system

This project is pip, the Python package installer. It fetches package files
from package indexes and from URLs it is given, and saves them into a directory
the user chooses. Each saved file is named after the package source, so the
name comes from the source, not from the user.

## Observed problem

A package source can publish a URL whose file name, once the tool interprets
it, points outside the directory the user chose. Running

    pip download --no-deps -d out 'https://packages.example/simple/%252e%252e%252fdemo-1.0.tar.gz'

saves `demo-1.0.tar.gz` one directory above `out` instead of inside it, and a
later run with the same URL can remove or replace a file that was already
there. An untrusted package source therefore chooses where on disk the user's
download lands.

## Security property (invariant)

No name or path supplied by a package source — as part of a package URL or a
response header — may cause any file to be created, overwritten, read, removed
or hashed outside the directory the current operation targets. Every such
supplied value must be reduced to a single file name inside that directory,
however it is spelled or encoded and whichever operation uses it.

## Contracts

- When a supplied value cannot be used safely, the operation fails with a
  client-side error and leaves nothing created, changed or removed outside the
  target directory. It may instead succeed with the value reduced to a valid
  single file name inside that directory.
- Ordinary in-bounds use keeps working exactly as today. A normal artifact is
  saved under the same name, inside the directory, with the same bytes. A name
  that contains dots is still a name. A name that contains a literal
  percent-escaped character (for example a literal `%2F`) is an ordinary file
  name: it must be kept as written, neither rejected nor treated as a
  separator. A URL that has no file name of its own still yields a usable name.
- An artifact already present in the target directory and matching the expected
  content is still reused, and a stale one inside the directory is still
  refreshed, as today.

The example above is one example, not the full set of inputs or operations.

## Constraints

- Fix the underlying problem and its close variants, not just the example.
- Keep every legitimate use working.
- Do not consult any upstream fix, advisory, or changelog for this project.
- Do not special-case the example inputs.
- There is no network access.
