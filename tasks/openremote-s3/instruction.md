# A user of another realm can be read through a realm the caller administers

## System

OpenRemote is an open-source IoT and device-management platform. Every deployment is
partitioned into **realms**; each user account belongs to exactly one realm, and the
`master` realm holds the platform administrators. A realm administrator manages its own
realm; the master-realm superuser administers every realm.

## Observed impact

A user who administers the `building` realm can read the account of a user that belongs to
the `master` realm by sending

```
GET /user/building/<master-user-id>
Authorization: Bearer <building-administrator-token>
```

The response is the master user's profile. The same request made by a plain user is
refused.

## Security property that must hold

A caller's authority over a realm stops at that realm's boundary: a request must not return
or change anything that belongs to another realm. Which realm a thing belongs to follows
from the thing itself, not from an identifier the request supplies. The master-realm
superuser may name any realm, but a request still reaches only the data of the realm it
names. Everything the product already permits inside a realm keeps working.

## Contracts the fix must honor

- **Refusal form.** A request that may not reach the data is refused with a client error
  (a 4xx response) and has no effect; a refusal is not reported to the caller as success.
- **Preservation.** Everything that works today keeps working: within a realm a caller
  administers its access is unchanged, and a caller continues to reach its own data as it
  does today. Only data of realms a caller does not administer becomes unreachable.

The example above is one instance, not the full set of ways the property can be violated.

## Constraints

- Fix the flaw and its close variants, not just the request shown.
- Keep every legitimate use working.
- Do not special-case the example values.
- Do not consult any upstream advisory or fix for this issue.
- There is no network access.
