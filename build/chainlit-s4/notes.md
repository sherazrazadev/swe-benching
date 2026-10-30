# Build notes — chainlit-s4

- Start (UTC): 2026-10-29T17:24Z
- End (UTC): 2026-10-29T17:45Z (stage-by-stage gate green; a single full-gate run was started afterwards and is recorded below)
- Advisory: GHSA-C39V-8HRW-H448 / CVE-2026-56104 / PYSEC-2026-4028 (chainlit/chainlit)
- Pinned: 76f59c076c7c1e1b401c7c458e6bf8f67114014c (direct parent of fix 5effb664f1e0af4a4f0a42fe63ea979676039a7f; no regression tests between them)
- Pattern B, track injected. Instruction is a report of one observed impact; the security
  property is stated once over session ownership.

## Design: levers (each line one mechanism)

1. **L1 — real route where the protection never existed (main, HOW-type).**
   The REST feedback route looks the live session up by the client-supplied session
   identifier and runs the application's feedback callback inside it, with no ownership
   comparison (backend/chainlit/server.py:881-912 at the pinned commit). Real, unmodified
   upstream. Reason to dismiss: it is a REST route that never rebinds a socket; the lookup
   only runs when a data layer and an `on_feedback` callback exist, and errors there are
   swallowed by the surrounding `try/except`. Security tests: callback never observes a
   session it does not own; request refused with 4xx. Coupled functional tests: the owner's
   own feedback callback still runs; an open deployment (no login, session with no owner)
   still runs it.
2. **L2 — wrong object, injected (HOW-type).**
   An injected thread-resume route checks the *thread* author (the real `is_thread_author`
   helper) and then rebinds the *session* named in the body to a caller-supplied socket id
   (backend/chainlit/server.py, injected next to the other thread routes). Reason to
   dismiss: "it already checks authorization — thread ownership". The security test makes
   the caller the thread author while the session belongs to someone else. Functional:
   a user who owns both thread and session still resumes.
3. **L3 — second implementation of the guarded operation, injected (where-type, extra).**
   When the handshake carries no session identifier the connect handler restores the
   session named by the product's sticky session cookie through a separate implementation
   that does not call the reported function (backend/chainlit/socket.py, injected
   `restore_sticky_session`, reader in backend/chainlit/auth/cookie.py). Realistic: the
   client already sets that cookie through the real `POST /set-session-cookie` route, and
   the server never read it, so a maintainer adding the fallback is plausible. Reason to
   dismiss: transport plumbing / load-balancer aid, not the handshake field the report
   shows. Security test: a connection carrying another user's session cookie is refused and
   nothing is rebound. Functional: the owner's own sticky cookie still restores.
4. **L4 — coupled must-keep-working value (HOW-type, functional).**
   The ownership rule must leave the no-owner deployment working in both directions
   (neither side authenticated) while refusing a one-sided identity. An over-broad check
   (refuse whenever an identity is missing) breaks every anonymous reconnect and the
   anonymous feedback callback. Reason to dismiss: "be strict, require an owner". Covered by
   functional tests only; there is no security direction, so its per-lever check is a
   `functional_fail` patch (overbroad_none.patch), not a `security_fail` patch.

## Injected sibling candidates (every one considered)

Real, unmodified upstream:
- `backend/chainlit/socket.py:41-49` restore_existing_session (reported landing point; fixed upstream).
- `backend/chainlit/server.py:900-903` PUT /feedback runs on_feedback in the looked-up session (picked: L1).
- `backend/chainlit/server.py:767` POST /set-session-cookie writes any client id into a cookie (note only: it is a provisioning helper, it never uses the value).
- `backend/chainlit/server.py` element/action/mcp/file routes: all already compare session owner; not gaps.
- `backend/chainlit/session.py:310-315` WebsocketSession.restore primitive: one caller at the pinned commit, latent sink.
- `backend/chainlit/slack|teams|discord/app.py`: per-message HTTPSession with a fresh uuid; no client-supplied id adopted, so no reachable session reuse at the pinned commit.
- `backend/chainlit/data/acl.py` is_thread_author: thread ownership, a real neighbouring guard (used by L2).
- DELETE /feedback: takes a feedback id only, no session; different resource, out of this advisory's scope.

Injected candidates:
- (a) An eighth sessionId REST route that drives the session (stop/clear/re-send). Picked first, then dropped: it is the same concept as L1 and would fall together with it.
- (b) A thread-resume REST route that checks the thread author and rebinds the session (picked: L2 — wrong object, distinct dismissal reason).
- (c) A sticky-cookie fallback restore in the handshake, separate implementation (picked: L3 — second implementation, distinct dismissal reason).
- (d) A `connection_successful` socket event re-bind. Dropped: same file as the report and same concept as (c) without the carrier difference.
- (e) A Slack/Teams adoption of a web session id. Dropped: no plausible carrier for the id in those transports, so it would not be findable by a blind engineer.
- (f) A GET route returning session-scoped user environment values. Dropped: same REST-session-lookup concept as L1.

Why the picks beat the rest: L2 is the only candidate whose existing guard is on the wrong object (it reads as authorized), so a solver must understand the mechanism; L3 is the only second implementation reachable through the real handshake, and it is reached by a different carrier than the report's. Both are far from the reported site (server.py, and a separate helper) and neither is touched by the published fix.

## What was verified on the pinned + injected tree (local, Python 3.12, no Docker)

- Reported exploit reproduces through `chainlit.socket.connect`: an authenticated attacker presenting a victim session id is bound to the victim session (victim.socket_id becomes the attacker socket; `WebsocketSession.get(attacker_sock)` is the victim session).
- L1 reproduces through `PUT /feedback` on the real FastAPI app: 200 and the app callback observes the victim session id.
- L2 reproduces through `POST /project/thread/resume`: 200 and the victim session is rebound to the attacker socket although the caller only authored the thread.
- L3 reproduces through `connect` with an unknown handshake id plus the victim id in the sticky cookie: session restored.
- Oracle blocks all four; owner/anonymous/new-session legitimate cases still work; project tests test_socket.py/test_server.py pass on the pinned tree and under the oracle (the internal `TestRestoreExistingSession` tests are deselected because the published fix itself had to edit them).

## What could not be verified

- Whether upstream main still has the /feedback route unguarded (read-only look at upstream is recorded in the Pattern B register).
- The Docker build and full gate until they are run (see status below).

## Open notes

- `common/builder/BUILDER.md` supersedes the build prompt's `/app` / delete-.git / kill-block wording: this task uses the Frontier 1.4 layout (`/workspace`, fresh one-commit git baseline, separate verifier, no allowlist, `tests/Dockerfile`).
- Out of scope, noted only: `POST /set-session-cookie` (server.py:764-780) accepts any session id from an unauthenticated body and writes it into a cookie.

## Gate results (stage by stage)

- `--only static`: PASSED (conformance, leak scan, hidden-test-leak scan, wrong-fix catalogue; the
  `blind` pass patch is declared in the manifest but is written later by the blind-fix step, so it
  is not present here; FAIRNESS.md is post-trial and not written here).
- `--only nop`: PASSED — 6/6 security tests fail on the pinned+injected tree, every functional test
  passes (9 hidden + 28 project socket + 52 project server).
- `--only oracle`: PASSED — 3 runs, reward 1.0, identical results.
- `--only patches`: PASSED — 12/12 checks behave as declared:
  missing_feedback 0.8333 (only the feedback security test fails), missing_resume 0.8333,
  missing_sticky 0.8333, published_only 0.5 (the three far-ish levers fail), permissive_none 0.6667
  (both one-sided-None security tests fail), overbroad_none 0.0 (three anonymous functional tests
  fail), crash_identity 0.0 (identity shape breaks legitimate owners), crash_as_refusal 0.8333
  (a 500 is not a refusal), check_after_restore 0.3333 (the rebind already happened),
  adjacent_api 0.6667, hardening 1.0, alt_fix 1.0.
- A single full-gate run was started after the stage-by-stage runs to leave `gate_report.json`; its
  result is appended when it finishes.

## Fairness notes I would raise myself

- The refusal form for a refused connection is the product's existing `ConnectionRefusedError`
  (the same exception the handshake already raises for a failed login and for a thread the caller
  does not author), and for HTTP a 4xx. Both are stated once in the report's contracts block.
- The functional project-socket group deselects `TestRestoreExistingSession::test_restore_existing_session_success`
  and `TestSocketEdgeCases::test_restore_existing_session_with_none_session_id`: both call the
  internal restore helper directly, and the published fix itself had to change the first one, so
  their signatures are not a behaviour contract a solver must preserve. The remaining 28 socket
  tests and all 52 server tests run from pristine copies.
- The two one-sided-None security tests encode the report's second property literally ("a session
  with no owner may be used by an unauthenticated request, and only by one"); they are reachable
  through the real handshake even though a deployment would have to change its login configuration
  to hold such a state. They are what makes the natural "only compare when both sides are present"
  guard fail.
- Full run `python3 -I common/gate/gate.py chainlit-s4` (GATE_PARALLEL=3): **PASSED** — static,
  nop, oracle (3 identical runs at reward 1.0) and patches (12/12 as declared). `gate_report.json`
  holds the result.
