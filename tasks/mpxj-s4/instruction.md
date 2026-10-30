# Schedule archives can write files outside the folder they are expanded into

## What this is

This project is a Java library that reads project schedules from files produced by many
project-management tools. Several of the formats it supports are container archives: a single
file holds a small set of embedded files (for example the several files that make up one
schedule database), and the library expands the archive into a temporary directory of its own
before it reads the schedule. A caller opens a schedule by handing the library a stream or a
file through its public reader; the library identifies the format from the content and uses the
matching reader.

## Observed problem

Opening a schedule archive whose embedded file entry carries a crafted name causes the library
to create and write a file at a location of the attacker's choosing, outside the temporary
directory created for that archive. Concretely, an application that opens a user-supplied
schedule archive with the library's public reader can be made to write the archive's embedded
content above the temporary directory while the archive is being expanded, before any schedule
data is parsed.

## Security property (invariants)

- While expanding any archive the library can read, no file name or path contained in the
  archive — wherever inside an entry that name is stored, and whichever supported archive
  container carries it — may cause the library to create, overwrite or write any file or
  directory outside the temporary directory the library created for that archive.
- If a name would resolve outside that directory, the entry must be refused: the expansion of
  that entry does not happen, and nothing outside the directory is created, overwritten or
  changed. Any clear error is acceptable; no particular exception type is required.

## Contracts

- **Refusal form.** A clear error with no side effect. Nothing outside the extraction directory
  may be created, overwritten or changed — not even an empty file or a directory.
- **Names are significant.** An accepted archive must produce exactly the same extracted names,
  at the same relative positions, as it does today. Legitimate entries may name a file directly
  or place it under one or more subdirectories, and directory entries must still be created.
- **Schedules keep loading.** An archive that contains a readable schedule must still be read
  and return that schedule.
- A legitimate entry name is an ordinary relative path inside the archive: a file name,
  optionally a few directory levels below it. The attack uses a path of comparable length that
  nonetheless resolves outside the extraction directory; both must be handled according to the
  property above.

The examples above are examples, not the full set of cases.

## Constraints

- Fix the underlying problem and its close variants, not only the example shown.
- Keep every legitimate use working.
- Do not look up the upstream fix for this issue.
- Do not special-case the example values.
