# Reference names escaping the reference storage

This project is a pure-Go implementation of Git. Applications embed it to open, read and change
repositories, and the names they give the library for references can come from their own input,
from configuration, or from a repository the library is asked to read.

## Observed impact

An application stores a reference under a name taken from its input. With a name such as
`refs/../../config`, the write leaves the reference area and replaces the repository's
configuration file, after which the repository can no longer be opened normally.

## Security property

Any name the library accepts for a reference — a full reference name, a shorthand from which one
is formed, or a name read from another source — must stay within the repository's reference
storage. Such a name may only create, read, change or remove the reference it names and that
reference's own stored history. It must never create, overwrite, expose or remove any other
repository data, including the repository's own administrative files and directories (its
configuration, packed references, index, hooks, object store and the like), whether or not the
name visibly climbs out of the reference area. A name that cannot be confined must be refused.

## Contracts

- A refused name returns an error and has no effect: nothing is created, changed or removed.
- Everything that works today keeps working exactly as today. A nested reference name and a
  root-level bookkeeping reference name both remain valid, as do symbolic references, the
  placeholder reference a newly initialised empty repository uses, and the stored history of
  references that have one.
- The examples in this report are examples, not the full set.

## Constraints

- Fix the problem and its close variants.
- Keep every legitimate use working.
- Do not look up the upstream fix.
- Do not special-case the example values.
