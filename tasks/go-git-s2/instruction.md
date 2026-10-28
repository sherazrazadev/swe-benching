# Reference names escaping the reference storage

This project is a pure-Go implementation of Git. Applications embed it to open, read and change
repositories, and they supply the names of the references the library is asked to work with. Those
names are not trusted: they can be arbitrary values chosen by whoever is using the application.

## Impact

A name the library accepts can reach beyond the storage it is meant for, so ordinary use of the
library can damage a repository or expose data the caller never asked for.

## Security property

Any name the library accepts for a reference must stay within the repository's reference storage.
It may act only on the reference that name denotes and on the data the repository stores for that
reference. It must never read, create, change, move or remove a different reference or any other
data the repository keeps, whatever the name looks like, however it reaches the library, and
whichever code path acts on it. A name that cannot be confined in this way must be refused.

## Contracts

- A refused name returns an error and has no effect: nothing is created, changed or removed.
- Everything that works today keeps working exactly as today, for every legitimate use of the
  library.

## Constraints

- Fix the problem and its close variants.
- Keep every legitimate use working.
- Do not look up the upstream fix.
- Do not special-case particular values.
