# Changing who can access a saved object is owner-only

## The system

This project is a log-management server. Users save searches and dashboards, and they work
with other shareable configuration objects such as event definitions, event notifications and
streams. Every shareable object records an owner and a set of grants: each grant names a user or
a team and the capability they hold on that object (view, manage, or own). Owners change an
object's grants; other people may be given the right to read it or to edit its content.

The HTTP API lets a client update such an object with a JSON body of the form
`{"entity": {...}, "share_request": {...}}`. The `share_request` block, when present, carries
the complete new grant set for the object. The object being updated is the one named by the
request target.

## Observed problem

A user who has been allowed to edit a saved dashboard but does not own it sends
`PUT /api/views/{id}` for that dashboard, with a body whose `share_request` names that same
user with the owner capability (or simply names no grantees at all). The server applies the
block: the user becomes an owner, or every other grant is removed, without owning the dashboard.
A single ordinary update request lets an editor take control of somebody else's object.

## Security properties (invariants)

- Changing the sharing of an existing object — adding a grant, changing a grant's capability, or
  removing one — is reserved to the object's owner. A caller who may edit the object but does
  not own it must not be able to change its grants through an update request, for every kind of
  object the product lets a user share, not only the kind first noticed.
- This holds for every form the sharing instruction can take: naming one grantee or many, asking
  for any capability including ownership of the object, and naming no grantee at all (a request
  that removes the existing grants).
- The ownership decision must be made about the object whose sharing is actually changed, not
  about some other object that a request happens to mention. Whatever identifiers the request
  body carries, a caller may not change the grants of an object it does not own.
- When such a request is refused, it must be refused as a client error, and it must leave the
  sharing unchanged: no grant may be created, changed or removed. An update that reports success
  while silently applying the sharing is not a fix.

## Keep working

Legitimate use must behave exactly as it does today, including:

- an owner updating an object together with a sharing instruction, sharing with one grantee or
  with many, and an owner removing every share;
- a user with edit permission updating an object's content in a request that carries no sharing
  instruction;
- creating an object together with an initial sharing instruction: the creator owns the new
  object and the instruction is applied to it;
- duplicating an object together with a sharing instruction: the instruction is applied to the
  copy;
- both dashboards and saved searches, and every other shareable object kind.

For example, a non-owner editor sending an update for a dashboard with a sharing block must be
refused; the same editor saving dashboard content without a sharing block must still succeed,
and the dashboard's owner sharing it with a colleague must still succeed. These are examples,
not the full set of object kinds or request shapes.

## Constraints

- Fix the underlying problem and its close variants, not just the exact example.
- Keep every legitimate use working.
- Do not special-case the example inputs.
- Do not consult any upstream fix, advisory, or changelog for this project.
- There is no network access.
