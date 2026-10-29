# A saved memory can silently disappear

## System

This project is a local memory system for coding agents. As an agent works, the
system records what happened in memory entries: an observation has a kind, a
name, a subtitle, a body, and lists of facts, concepts and files; a session
summary records a stretch of work in its own set of content fields. Entries are
kept in a local database that the agent, its search and its interface read back
later.

When the system writes an entry it tries not to keep the same content twice: it
derives an identity from the entry's content and, if it finds an entry with that
identity that was recorded recently, it skips the write and reports the entry it
already has.

## Observed impact

A genuinely different entry can be discarded as a repeat. Save a memory whose
name is `ab` and whose body is `c`, then save a different memory whose name is
`a` and whose body is `bc`: both calls report success, but only the first is
stored. The second body is gone, the caller receives the first entry's id, and
reading the memories back shows only the first.

## Security property that must hold

No two entries with different content may ever be treated as the same entry.
Two entries are the same only when every content field is equal; when any field
differs, both entries must be kept and both must remain readable. This holds for
every record the product stores, for every identity it derives from entry
content, and for every decision it bases on such an identity — whatever
characters the values contain, and wherever the decision is made.

## Contracts the fix must honor

- **Outcome.** A write that is not a repeat must succeed and must store a new
  entry; if the operation reports an entry id to the caller, it must report the
  new entry's id, never an existing one, and the write must not fail. A write
  that is an exact repeat must still be recognised and must not create a second
  entry.
- **Inputs.** Every content value is an arbitrary string: empty values are
  allowed and any Unicode character, including control characters, may occur in
  any field. Values are not restricted in length.
- **Preservation.** Everything that works today keeps working: an exact repeat
  inside the existing recent-repeat window is still collapsed, an exact repeat
  after that window is still stored, entries with clearly different content are
  still stored separately, and the stored identity keeps its existing format so
  that existing data stays usable.
- **Magnitudes.** A legitimate write repeats content that is exactly equal to
  what was stored; the flaw is two writes whose content differs.
- The example is one example, not the whole set.

## Constraints

- Fix the flaw and its close variants, not just the example input.
- Keep every legitimate use working.
- Do not special-case the example, and do not weaken or remove behaviour that
  is not part of the flaw.
- Do not consult any upstream advisory or fix for this issue.
