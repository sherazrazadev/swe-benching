# Caller-supplied values can make `git` run a program

`simple-git` is a Node.js library that applications use to run `git`. Values that an
application's callers supply reach the library and are passed into repository operations.
The library already refuses values that would let such input become a program `git` runs,
unless the application has explicitly opted in to that behaviour.

That protection is incomplete. A caller-supplied value can still cause `git` to run a
program of the caller's choosing.

## Required behaviour

For every invocation the library builds, a value supplied by the application's caller must
never cause `git` to run a program of the caller's choosing, however the library passes
that value to `git`, unless the application has enabled the existing opt-in that permits
caller-chosen programs. Every such value must be refused before `git` is started.

## Contracts

- A refused call must fail with a client error before `git` is started and must leave the
  repository and the environment unchanged.
- Everything that works today keeps working exactly as today. Values that do not name a
  program keep working, however they are supplied.
- Each invocation must request only the opt-in governing the capability it uses, and an
  application that has enabled an opt-in must still be able to do exactly what that opt-in
  permits.

## Constraints

- Fix the problem for every invocation.
- Keep legitimate use working.
- Do not look up the upstream fix or existing implementations.
- Do not special-case one input.
- There is no network access.
