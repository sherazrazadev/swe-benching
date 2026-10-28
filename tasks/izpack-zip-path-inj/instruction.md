# Installer: packaged file targets

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
the user had chosen. The location came from the installer's own metadata and was
used without any check.

## Security properties (invariants)

- No location value that the toolkit takes from an installer's packaged metadata
  may be used to create, write, move, rename, rewrite or delete anything if that
  value contains a parent-directory segment (".."). This holds however the value
  is carried, whichever installation step would use it, and for the location that
  is actually used after the toolkit substitutes configured values into it.
- The same rule holds when a file entry is created through the toolkit's public
  file-entry interface, that is, while a description is compiled into an
  installer: a traversing target must be refused there too.
- A refused location must be rejected with an error and must produce no side
  effect for that entry: no directory created and no file created, written, moved
  or rewritten. Refusing one entry must not stop other legitimate entries from
  installing.
- Locations that are absolute and free of parent-directory segments remain
  legitimate, including targets outside the installation directory (for example a
  fixed system configuration path). Those must install exactly as they do today,
  as must ordinary nested targets inside the installation directory.

## Constraints

- Fix the problem and its close variants, not only the single example above.
- Keep every legitimate use working.
- Do not look up the upstream advisory or fix; solve it from the code.
- Do not special-case the example input.
- There is no network access.

Examples in this report are examples, not the complete set of inputs the fix must
handle.
