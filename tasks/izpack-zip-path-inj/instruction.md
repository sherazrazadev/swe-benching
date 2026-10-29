# Installer: packaged locations

## System

This project is a toolkit for building self-contained installers. A project
description lists one or more packs; each pack declares files and directories to
install together with the location each one is installed to. The toolkit compiles
that description into an installer archive. When the archive runs on a user's
machine, it reads its packaged metadata, resolves any configured values in the
declared locations, creates the target directories and writes each entry in place.

The description and the packaged metadata are data: an installer may be built
from, or its compiled metadata replaced with, material the person running it did
not author.

## Observed impact

Running an installer whose packaged metadata named a target location containing a
parent-directory segment ("..") created a file outside the installation directory
the user had chosen. The location came from the installer's own metadata.

## Security properties (invariants)

- No target location value the toolkit accepts — whether while compiling a
  description, from an installer's packaged metadata, or after configured values
  are substituted into it — may be used to create, write, move, rename, rewrite or
  delete anything if it contains a parent-directory segment (".."). This includes
  the location ultimately used.
- A refused location must be surfaced as an installation failure and must produce no
  side effect for that entry. Refusing one entry must not stop other legitimate
  entries from installing.
- Locations that are absolute and free of parent-directory segments remain
  legitimate, including targets outside the installation directory. Those must
  install exactly as they do today, as must ordinary nested targets inside the
  installation directory.

## Constraints

- Fix the problem and its close variants, not only the single example above.
- Keep every legitimate use working.
- Do not look up the upstream advisory or fix; solve it from the code.
- Do not special-case the example input.
- There is no network access.

Examples in this report are examples, not the complete set of inputs the fix must
handle.
