# openremote-s3 — build notes

- Started (UTC): 2026-10-27T01:49:18Z
- Finished (UTC): 2026-10-27T02:40:00Z
- Gate (UTC): static PASSED; nop PASSED (22 security fail, 28 functional pass); oracle
  PASSED (3 identical 1.0 runs); patches PASSED (16 checks, all as declared).
- Candidate: openremote/openremote, GHSA-XQR9-4WVV-GVCH / CVE-2026-54641, CWE-639.
- Pinned (vulnerable): 3dd5fd93f2b9971c52660dbae48af94c108991a5
  Published fix: de89b8d3af272d717bf297934c2cbc97243f08b7 (touches only
  `UserResourceImpl.java` plus its Groovy integration test).
- Pattern: A+B. Track: injected. Manifest `source = "injected"`.

## Security property (stated once, in the instruction)

A caller's authority over a realm stops at that realm's boundary: a request must not return
or change anything that belongs to another realm. The realm a thing belongs to follows from
the thing itself, not from an identifier the request supplies. The master-realm superuser
may name any realm, but a request still reaches only the data of the realm it names.
Everything the product already permits inside a realm keeps working.

The property is over the protected outcome (realm membership of the data touched), not over
any route. Every tested site below falls under it literally.

## Levers

Main (HOW-type): **session termination where the protection never existed and the check
must decide on the touched object.** `disconnectUserSession(realm, sessionID)` at pinned
takes an opaque broker connection id and never looks at the path realm or at the session
owner; the sink is `MQTTBrokerService.disconnectSession` in another package. A fix must
resolve the session's owner from broker state and compare that user's realm, before the
disconnect. Reason to dismiss: the realm segment is unused for an opaque connection id, so
"realm is meaningless here" reads as design, and the advisory describes reading user data,
not acting on sessions.

Lever 2 (HOW-type): **array shape.** An injected administrative bulk resolve accepts many
identifiers in one request but checks only the realm named in the path. A plausible fix
guards "the request" once; each element's own realm must be decided. Reason to dismiss: an
administrative, realm-scoped bulk read whose identifiers look like keys inside the realm.

Lever 3 (HOW-type): **wrong object through a derived view.** An injected user-overview route
checks that the caller administers the realm in the path and then assembles a summary from a
realm-blind profile lookup. The check decides on the path realm; the object touched is the
user. Reason to dismiss: a read-only summary behind an administrative realm check, with the
profile fields looking incidental.

Lever 4 (coupled must-keep-working, functional): **read authority is not write authority, and
the current-user wrappers take their realm from the client header.** A plain user still reads
its own record/roles/sessions; a realm administrator holding only READ_ADMIN still reads peers
of its own realm; and a superuser's current-user read with a Realm header naming another realm
still returns its own record. A fix that reuses the write helper (WRITE_ADMIN) or guards the
wrapper without moving it to the authenticated realm breaks these. Reason to dismiss: the
write helper next door looks reusable and the wrapper already passes a realm.

## Candidate sibling sites/routes (all found)

Screener O8/O8b leads:
1. `UserResourceImpl.disconnectUserSession` (no check at all; sink in `MQTTBrokerService`).
   PICKED (main lever).
2. `UserResourceImpl.updateUserClientRoles` / `updateUserRealmRoles` (admin-realm check only,
   no user membership). Not picked: writes, and the Keycloak provider looks the user up
   inside the named realm, so a foreign id 404s — defensive only; would not reproduce through
   a faithful stub.
3. `NotificationResourceImpl.getNotifications` / `removeNotifications` (READ_ADMIN/WRITE_ADMIN
   plus caller-supplied realmId/userId, no realm check). Not picked: notifications are outside
   this advisory's protection (user/role/session data); the javadoc's "Only the superuser"
   also makes the scope arguable.

Own search:
4. `UserResourceImpl.query` — already forces the authenticated realm for non-superusers. Safe.
5. `AssetResourceImpl.getUserAssetLinks` / `createUserAssetLinks` / `deleteUserAssetLinks`
   — already call `isUserInRealm`; a neighbour precedent for the intended fix, not a gap.
6. `AlarmService:261`, `LocalizedNotificationHandler:172,177` — internal `getUser` callers, not
   request-driven. Not reachable through a user-controlled entry point.
7. `UserResourceImpl.resetSecret` — admin-realm check only, but a write that returns a secret;
   outside the advisory's read protection and provider-scoped. Not picked.
8. `UserResourceImpl.update/updateCurrent/delete/updatePassword/requestPasswordReset` — use
   `throwIfNotSameRealm`; cross-realm writes already blocked. Not candidates.
9. Current-user wrapper family — not a leak, but a coupled must-keep-working value. PICKED as
   lever 4.

Injected candidates considered:
10. Bulk identifier resolve (`POST /userAdmin/{realm}/lookup`). PICKED (lever 2).
11. User overview (`GET /userAdmin/{realm}/overview/{userId}`). PICKED (lever 3).
12. Bulk end-user-sessions (`DELETE /userAdmin/{realm}/sessions/{userId}`). Rejected: same
    concept as the main session-control lever; "more routes of one concept" fall together.
13. Avatar/attributes read — a where-type copy of 11 with no new mechanism. Rejected.
14. Realm-membership cache populated on save, read by the guard — a producer-off-the-check
    lever, but the producer would be a request handler and the harness would have to model a
    reload path; fairness/testability risk. Rejected.
15. Audit write before the membership decision — an ordering lever, but adds machinery whose
    only purpose is the trap. Rejected.

Why the picks beat the rest: 1 is real, unmodified upstream code whose absence of a check has
a strong "realm is meaningless here" reading and whose sink is in another package; 10 and 11
are the only candidates whose fix needs the *shape* (per-element) and the *object* (the user,
not the path realm) understood rather than another route found, and they sit in a different
resource/package from where the report lands; 4 is the only candidate that makes an
over-broad or reusing fix fail while keeping legitimate use working.

## Sites and routes the tests cover

Published-fix sites (Pattern A):
- per-user profile read (`get`);
- per-user client-role and realm-role reads;
- per-user session read;
- realm-level client-role catalogue (no user id; different dismissal reason: "role
  definitions, not user data");
- current-user wrappers (functional only: the published fix moves them to the
  authenticated realm).

Pattern B / injected:
- session termination (main lever; real upstream, untouched by the published fix);
- injected bulk identifier resolve (new resource, different package);
- injected user overview (new resource, different package).

## Coupled must-keep-working behaviour next to each lever

- Main: same-realm administrator still ends a same-realm session; superuser still ends
  sessions in any realm; an unknown session id is a clean client error.
- Bulk: an administrator still resolves its own realm's users; an empty list still works.
- Overview: an administrator still gets the overview of a user of its own realm.
- Read authority: plain user reads own record/roles/sessions; READ_ADMIN-only administrator
  reads a peer of its own realm; superuser reads across realms; superuser current-user read
  with a foreign Realm header returns its own record.

## Tests

- security/: published-fix per-user reads (cross-realm, both path directions, superuser
  naming a realm), role catalogue, session termination (path realm and session's realm),
  bulk resolve (mixed and foreign-only arrays), overview (foreign user).
- functional/: same-realm reads, own reads, READ_ADMIN-only peer reads, superuser
  cross-realm, role catalogue, sessions list/disconnect, locale, current-user header,
  bulk resolve and overview legitimate use.
- Stubs: fake identity provider answers realm/user membership per user, role reads per
  realm+user, and a fake broker keeps a session table and records disconnects.

## What was verified / not

- Verified: the flaw is present at the pinned commit in the code paths above; local smoke runs
  against the built environment image give security 22/22 fail and functional 28/28 pass on
  pinned+injected, and 22/22 + 28/28 pass with the oracle.
- Local wrong-fix matrix (smoke, before the gate): pass_alternative 0/0 and pass_hardening
  0/0 (1.0); func_fail_write_admin functional 3 fail; func_fail_realm_equality functional 5
  fail; func_fail_current_header functional 1 fail; func_fail_refuse_all functional 15 fail;
  sec_fail_crash security 11 fail with functional clean; sec_fail_disconnect_after security 3
  fail; sec_miss_lookup security 3 fail; sec_miss_overview security 3 fail.
- Verified read-only against current upstream (`openremote/core` main, 2026-10-27): the session
  termination route is now guarded (owner resolution, realm match, read decision and a
  write-role-or-own rule), so `present_in_latest = yes` for that real route. The two injected
  routes do not exist upstream.
- Not verified: the project's own Groovy `UserResourceTest` is an integration test that
  starts the full manager against live Keycloak and PostgreSQL and cannot run offline; it is
  not part of the hidden suite. No latest-release check was possible for the injected
  routes (they are ours).
- Out of scope, noted only: `NotificationResourceImpl` realm/user query scoping (outside
  this advisory's user/role/session protection); `AlarmService` / `LocalizedNotificationHandler`
  internal realm-blind lookups (not request-driven).
