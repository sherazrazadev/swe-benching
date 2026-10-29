# Installer: packaged locations

## System

This project is a toolkit for building self-contained installers. A project
description lists one or more packs; each pack declares entries together with the
location each one is installed to. The toolkit compiles that description into an
installer archive. When the archive runs on a user's machine, it applies those
locations there.

The description and the packaged metadata are data and may come from someone
other than the person running the installer.

## Observed impact

Running an installer whose packaged metadata named a target location containing a
parent-directory segment ("..") created a file outside the installation directory
the user had chosen.

## Security properties (invariants)

- No target location value the toolkit accepts, however it enters the toolkit, may
  be retained or used to create, write, move, rename, rewrite or delete anything if
  it contains a parent-directory segment (".."), including any location ultimately
  used.
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
