# Build one security-fix benchmark task (build-v1)

## What this is
We build a security-fix benchmark from published, already-fixed advisories in open-source projects.
You build ONE task, from the advisory below.

The task pins the project at the commit just before the published fix and gives a solver agent that
code plus a short problem report (`instruction.md`). Hidden behavioural tests then score the
solver's fix. The tests check that the flaw is closed, using harmless inputs and markers, and that
legitimate use still works.

Everything stays on this machine. Describe each mechanism in one line in notes and reports; the
tests hold the detail, so never write exploitation steps out in prose. Stay inside this advisory's
own protection, in this repository, at the pinned commit. Note anything outside that scope in one
line in your report, and do not build on it.

Project root: `/home/mara/cwe-bench`. Task: `authorizer-s4`. Pattern: `A`. Track: `injected`.

## Goal and acceptance
- **The bar.** Two target models (DeepSeek V4.1 Flash, MiMo-V2.6-Pro) must each fail all 3
  finished attempts because of their own judgement.
- **Fairness.** Everything the tests require must be findable from `instruction.md` plus the code,
  or be standard expert knowledge. A careful engineer who knows where to look fixes it in about
  45 minutes.
- **What never counts as a failure:** timeouts, and runs cut by API or network errors.
- **Proof.** A task is built only when the gate passes. A task that misses the bar is reported as
  such, never shipped weaker.

## Inputs
- Advisory: ["GHSA-29RF-F4VV-PVQ6", "CVE-2026-35511", "GO-2026-6227"]; authorizerdev/authorizer; improper authentication / federated account linking and takeover (CWE-287, nOAuth class)
- Pinned (vulnerable) commit: 9c3ac813b05480c3bfef8186364ce8b0b32a4b68. Published fix: 66fe488fd2a4e7acf1e517334344d5e8f3ddd296.
- The screener's record (a lead to verify, not a fact):
  ```json
  {
 "screener_version": "screener-v2",
 "lessons_version": "lessons-v2",
 "model": "deepseek-flash",
 "entry_id": "15174",
 "advisory_ids": [
  "GHSA-29RF-F4VV-PVQ6",
  "CVE-2026-35511",
  "GO-2026-6227"
 ],
 "repo": "authorizerdev/authorizer",
 "pinned_commit": "9c3ac813b05480c3bfef8186364ce8b0b32a4b68",
 "fix_commits": [
  "66fe488fd2a4e7acf1e517334344d5e8f3ddd296"
 ],
 "trust_decision": {
  "summary": "A social/OAuth login may only resolve (sign up, link into, or open a session on) a local account using an email address the identity provider itself attested; the decision is made once in OAuthCallbackHandler after provider processing and before the signup/link branches, and the attested flag is produced per-provider.",
  "evidence": [
   "internal/http_handlers/oauth_callback.go:178",
   "internal/http_handlers/oauth_callback.go:207-208",
   "internal/http_handlers/oauth_callback.go:239-268",
   "internal/http_handlers/oauth_callback.go:269-320",
   "fix.diff:1302",
   "fix.diff:1435-1451"
  ]
 },
 "landing_point": {
  "where": "internal/http_handlers/oauth_callback.go:178",
  "why": "The summary's 'OAuth identity linking to unverified email accounts' points straight at the email-keyed lookup that decides signup vs login; the account merge/stolen-session branch sits immediately below at 269-320."
 },
 "fix_sites": [
  {
   "where": "internal/http_handlers/oauth_callback.go:112-150",
   "entry_point": "GET|POST /oauth_callback/:oauth_provider (internal/server/http_routes.go:75-76)",
   "module_kind": "http_handler"
  },
  {
   "where": "fix.diff:1289-1319",
   "entry_point": "GET|POST /oauth_callback/:oauth_provider",
   "module_kind": "http_handler"
  },
  {
   "where": "internal/http_handlers/oauth_callback.go:207-208",
   "entry_point": "GET|POST /oauth_callback/:oauth_provider",
   "module_kind": "http_handler"
  },
  {
   "where": "internal/http_handlers/oauth_callback.go:239-268",
   "entry_point": "GET|POST /oauth_callback/:oauth_provider",
   "module_kind": "http_handler"
  },
  {
   "where": "internal/http_handlers/oauth_callback.go:471-506",
   "entry_point": "GET|POST /oauth_callback/google, /twitch, /microsoft (oidcClaims + toUser)",
   "module_kind": "http_handler (claim mapper)"
  },
  {
   "where": "internal/http_handlers/oauth_callback.go:508-550",
   "entry_point": "GET|POST /oauth_callback/google",
   "module_kind": "http_handler (provider processor)"
  },
  {
   "where": "internal/http_handlers/oauth_callback.go:562-701",
   "entry_point": "GET|POST /oauth_callback/github",
   "module_kind": "http_handler (provider processor)"
  },
  {
   "where": "internal/http_handlers/oauth_callback.go:703-779",
   "entry_point": "GET|POST /oauth_callback/facebook",
   "module_kind": "http_handler (provider processor)"
  },
  {
   "where": "internal/http_handlers/oauth_callback.go:781-857",
   "entry_point": "GET|POST /oauth_callback/linkedin",
   "module_kind": "http_handler (provider processor)"
  },
  {
   "where": "internal/http_handlers/oauth_callback.go:859-930",
   "entry_point": "GET|POST /oauth_callback/apple",
   "module_kind": "http_handler (provider processor, map decode)"
  },
  {
   "where": "internal/http_handlers/oauth_callback.go:932-1030",
   "entry_point": "GET|POST /oauth_callback/discord",
   "module_kind": "http_handler (provider processor, map decode)"
  },
  {
   "where": "internal/http_handlers/oauth_callback.go:1043-1166",
   "entry_point": "GET|POST /oauth_callback/twitter",
   "module_kind": "http_handler (provider processor, map decode)"
  },
  {
   "where": "internal/http_handlers/oauth_callback.go:1168-1212",
   "entry_point": "GET|POST /oauth_callback/microsoft",
   "module_kind": "http_handler (provider processor)"
  },
  {
   "where": "internal/http_handlers/oauth_callback.go:1215-1264",
   "entry_point": "GET|POST /oauth_callback/twitch",
   "module_kind": "http_handler (provider processor)"
  },
  {
   "where": "internal/http_handlers/oauth_callback.go:1266-1349",
   "entry_point": "GET|POST /oauth_callback/roblox",
   "module_kind": "http_handler (provider processor, map decode)"
  },
  {
   "where": "fix.diff:942-1047",
   "entry_point": "GET|POST /oauth_callback/:oauth_provider -> accountHasState",
   "module_kind": "http_handler (new storage-state helper)"
  },
  {
   "where": "fix.diff:26-27",
   "entry_point": "CLI flags --microsoft-allowed-tenants, --oauth-allow-unverified-provider-email (registered after cmd/root.go:250)",
   "module_kind": "cli/config defaults"
  },
  {
   "where": "fix.diff:850-863",
   "entry_point": "internal/config.Config consumed by the callback",
   "module_kind": "config"
  },
  {
   "where": "fix.diff:875-880",
   "entry_point": "audit event oauth.unverified_account_replaced",
   "module_kind": "constants"
  },
  {
   "where": "fix.diff:42-53",
   "entry_point": "process start-up (cmd/root.go runRoot)",
   "module_kind": "cli/config"
  }
 ],
 "O1_entry_points": 2,
 "O2_out_of_scope_site": {
  "kind": "second_implementation",
  "where": "internal/http_handlers/oauth_callback.go:859-930"
 },
 "O3_reason_to_dismiss": "The obvious fix is the shared ID-token mapper: everything that decodes a typed token funnels through oidcClaims (oauth_callback.go:471-506), so adding email_verified there 'covers the OIDC providers', while the processors that unmarshal raw JSON maps are treated as a different concern whose addresses are already verified by construction (GitHub filters to Verified, Discord/Twitter/Roblox synthesize non-routable addresses) - which leaves Apple, LinkedIn, Discord and Roblox with no attestation signal at all.",
 "O4_distance": {
  "files": 5,
  "packages": 4,
  "repo_mb": null
 },
 "O5_coupled_behaviour": {
  "what": "A returning federated user whose stored account is unverified because the same provider never attested the address: the pre-hijack guard deletes and recreates the account on every login, silently dropping its id, roles and org memberships; the legitimate behaviour is that this account must keep working, so the delete has to be scoped to accounts created by another credential and additionally bounded to stateless accounts. A second, cross-file legitimate behaviour is the per-org OIDC broker, which must keep accepting IdPs that omit email_verified for brand-new principals - an over-broad 'refuse any unattested federated email' fix breaks org SSO, and SAML asserts the address by construction.",
  "where": "internal/http_handlers/oauth_callback.go:239-268"
 },
 "O6_input_shapes": [
  "email_verified as a JSON boolean (Google, Twitch, Microsoft, Roblox)",
  "email_verified as the quoted string \"true\" (Apple documents both forms; LinkedIn ships both) - handled by flexBool/claimTruthy",
  "email_verified absent altogether (Entra v2 ID tokens carry none) - must decode to unverified, not to a decode error",
  "Microsoft xms_edov optional claim standing in for email_verified",
  "Microsoft tid vs iss consistency plus multi-tenant aliases common/organizations/consumers versus a pinned GUID/domain, and a --microsoft-allowed-tenants list",
  "map-decoded provider payloads: Discord `verified`, Roblox `email_verified`, LinkedIn userinfo `email_verified`",
  "synthetic fallback addresses (discord-<id>/twitter-<id>/roblox-<sub> on .oauth.internal) that are attested by construction",
  "GitHub REST /user email versus the /user/emails fallback filtered to Verified addresses",
  "signup_methods as a comma-separated list containing the near-miss pair twitch/twitter, needing an exact-token match not a substring match",
  "--oauth-allow-unverified-provider-email compatibility flag: found vs not-found, and same-provider vs other-credential ownership"
 ],
 "O7_producer": {
  "kind": "schema",
  "where": "internal/storage/schemas/user.go:29",
  "check_calls_producer": false
 },
 "O8_uncovered_routes": [],
 "O8b_injection_room": [
  {
   "where": "internal/http_handlers/oauth_callback.go:112-150",
   "sibling": "An eleventh social provider added to the callback switch whose processor returns only (*schemas.User, error) again",
   "why_realistic": "All ten existing processors had exactly that signature at the pinned commit, so copying the neighbouring case is the natural way to add a provider - and the new one then has no way to surface attestation."
  },
  {
   "where": "internal/http_handlers/oauth_sso.go:514-524",
   "sibling": "The org OIDC SSO broker resolving an existing local account by the upstream email instead of refusing the collision",
   "why_realistic": "The broker already builds the same federatedProfile shape and already sits next to a one-line collision guard at oauth_sso.go:574-578, so a per-org 'link my enterprise users to their existing accounts' setting is a plausible feature."
  },
  {
   "where": "internal/http_handlers/saml_sp.go:485-497",
   "sibling": "extractSAMLProfile continuing to hardcode EmailVerified: true while a sibling IdP-broker path starts linking by email",
   "why_realistic": "The SAML and OIDC brokers share jitProvisionFederatedUser by design; a maintainer extending the shared core to link by email would inherit the hardcoded true and reintroduce the same trust-the-IdP-attribute flaw."
  }
 ],
 "O9_family": "improper authentication / federated account linking and takeover (CWE-287, nOAuth class)",
 "O9_dos": false,
 "O10_build": {
  "language": "Go",
  "toolchain": "go 1.26.5 (go.mod:3); Makefile targets for build/test; node only for web/dashboard and e2e-playground (not needed for this area)",
  "services": [],
  "offline_after_build": true,
  "project_tests": "Unit tests in internal/http_handlers/oauth_callback_test.go, oauth_github_test.go, oauth_discord_test.go, oauth_roblox_test.go, oauth_twitter_test.go, oauth_providers_docs_test.go drive the provider processors with httptest and an in-process OIDC provider (issuer overridable via internal/config/test_oauth_override.go); integration tests in internal/integration_tests run on sqlite; e2e-playground/tests/social/*.spec.ts need docker compose and are not usable here."
 },
 "O11_fix_minutes": 50,
 "O12_red_flags": [],
 "O13_recall_risk": "medium",
 "pattern_fit": "A",
 "j": {
  "j_multi_site": 1,
  "j_sites_touched": "internal/http_handlers/oauth_callback.go; internal/http_handlers/oauth_account_state.go (new); internal/config/config.go; internal/constants/audit_event.go; cmd/root.go (the same commit also touches unrelated security areas - see out_of_scope_notes)",
  "j_sibling_sites": "no",
  "j_cause_other_layer": 1,
  "j_defence_ineffective": 0,
  "j_overbroad_breaks_legit": 1,
  "j_tempting_wrong_fix": "Add email_verified to the shared oidcClaims mapper and hard-refuse any unattested provider email right before the account lookup, leaving the seven raw-map processors open and deleting or locking out legitimate same-provider returning users."
 },
 "out_of_scope_notes": [
  "Patch commit 66fe488 bundles unrelated security fixes outside this advisory: single-use TOTP enforcement (internal/authenticators/totp/totp.go), admin session id randomness (internal/token/admin_session.go, internal/crypto/random.go), admin lockout keying (internal/token/admin_lockout.go, internal/grpcsrv/transport/grpc_metadata.go) and verification-token purpose binding (internal/service/verification_purpose.go, internal/http_handlers/verify_email.go). Not pursued; they belong to other advisories.",
  "e2e-playground docker-compose/playwright changes add an authorizer-email-verify instance; environment scaffolding only, not part of the flaw."
 ],
 "unverified": [
  "repo_mb: no shell was available in this session, so the repository could not be measured; left null.",
  "Buildability was inferred from go.mod and the existing test layout; go build / go test were not executed (no shell allowed).",
  "present_in_latest is 'unknown' by instruction (no latest release given); O8 is empty in any case. Routes audited and found protected at the pinned commit: org OIDC SSO broker (internal/http_handlers/oauth_sso.go:574-578 refuses an email collision), SAML ACS (internal/http_handlers/saml_sp.go:288 via the same guard), magic-link/OTP/reset routes (mailbox-control proof)."
 ]
}
  ```
- Published fix sites:   - internal/http_handlers/oauth_callback.go:112-150 — entry point: GET|POST /oauth_callback/:oauth_provider (internal/server/http_routes.go:75-76) [http_handler]
  - fix.diff:1289-1319 — entry point: GET|POST /oauth_callback/:oauth_provider [http_handler]
  - internal/http_handlers/oauth_callback.go:207-208 — entry point: GET|POST /oauth_callback/:oauth_provider [http_handler]
  - internal/http_handlers/oauth_callback.go:239-268 — entry point: GET|POST /oauth_callback/:oauth_provider [http_handler]
  - internal/http_handlers/oauth_callback.go:471-506 — entry point: GET|POST /oauth_callback/google, /twitch, /microsoft (oidcClaims + toUser) [http_handler (claim mapper)]
  - internal/http_handlers/oauth_callback.go:508-550 — entry point: GET|POST /oauth_callback/google [http_handler (provider processor)]
  - internal/http_handlers/oauth_callback.go:562-701 — entry point: GET|POST /oauth_callback/github [http_handler (provider processor)]
  - internal/http_handlers/oauth_callback.go:703-779 — entry point: GET|POST /oauth_callback/facebook [http_handler (provider processor)]
  - internal/http_handlers/oauth_callback.go:781-857 — entry point: GET|POST /oauth_callback/linkedin [http_handler (provider processor)]
  - internal/http_handlers/oauth_callback.go:859-930 — entry point: GET|POST /oauth_callback/apple [http_handler (provider processor, map decode)]
  - internal/http_handlers/oauth_callback.go:932-1030 — entry point: GET|POST /oauth_callback/discord [http_handler (provider processor, map decode)]
  - internal/http_handlers/oauth_callback.go:1043-1166 — entry point: GET|POST /oauth_callback/twitter [http_handler (provider processor, map decode)]
  - internal/http_handlers/oauth_callback.go:1168-1212 — entry point: GET|POST /oauth_callback/microsoft [http_handler (provider processor)]
  - internal/http_handlers/oauth_callback.go:1215-1264 — entry point: GET|POST /oauth_callback/twitch [http_handler (provider processor)]
  - internal/http_handlers/oauth_callback.go:1266-1349 — entry point: GET|POST /oauth_callback/roblox [http_handler (provider processor, map decode)]
  - fix.diff:942-1047 — entry point: GET|POST /oauth_callback/:oauth_provider -> accountHasState [http_handler (new storage-state helper)]
  - fix.diff:26-27 — entry point: CLI flags --microsoft-allowed-tenants, --oauth-allow-unverified-provider-email (registered after cmd/root.go:250) [cli/config defaults]
  - fix.diff:850-863 — entry point: internal/config.Config consumed by the callback [config]
  - fix.diff:875-880 — entry point: audit event oauth.unverified_account_replaced [constants]
  - fix.diff:42-53 — entry point: process start-up (cmd/root.go runRoot) [cli/config]
- Uncovered routes to confirm (pattern B): none
- Design plan from the lead: No lead plan is provided for this task — you are the lead as well as the builder. Using the Design section above and the screener record, design the task yourself and WRITE YOUR PLAN in `notes.md` BEFORE you build:
  - choose the main lever and at least one more, each with a DIFFERENT reason a solver would dismiss or skip it. The main lever must be HOW-type (its fix needs the mechanism understood: a producer the check never calls, a coupled must-keep-working value, a shape a plausible check mishandles, a route where the protection never existed); another entry point or a planted copy is only an extra;
  - decide the sites, routes and input shapes the security tests will cover;
  - identify the coupled must-keep-working behaviour next to each lever, for the functional tests;
  - for the injected track: decide the realistic sibling gap(s) to add — each must be code a maintainer could plausibly have left, reachable through the real entry point, covered by the task's one general property (never by a sentence of its own), and placed where the published fix never touches. First list EVERY possible sibling site and route you can find (the screener's O8/O8b leads plus your own search of the code). Then pick 2–4 of them: the most complex and hardest to find of all the candidates (how-type over where-type, far from where the report leads, with a plausible reason to dismiss), each with a different reason a solver would skip it. Record the full candidate list, and why each pick beat the others, in notes.md;
  - write the security property ONCE, in general terms over the protected data or outcome, before choosing routes. Every route and sibling must fall under it as written; the report must not describe where any of them lives;
  - if this candidate cannot support a fair task that meets the bar (flaw does not reproduce at the pinned commit through a real entry point, needs network/GPU/GUI at run time, or no design meets the bar), STOP and report why. Do not ship a weak task.
Follow every rule in the Design, Report, Tests and Proof sections exactly. You choose the design; the rules are fixed.
- Host notes: none

## Design: where difficulty comes from
Models find the code the report leads to and diagnose it correctly. They fail on scope. Build these
in, in order of evidence:
1. **Pattern A: the published fix's far sites.**
   - The report leads to one site. The tests cover every entry point the published fix protects,
     including one in a module that looks out of scope: a second implementation, a lower-level
     public API, a wrapper, a save/reload path, or a defaults or merge route.
   - Give it a plausible **reason to dismiss**, and **distance**: another file or package from the
     landing point.
   - **A second implementation is the strongest form of this**: separate code doing the same
     guarded operation (a fallback backend, another package, another transport, a legacy version),
     so fixing the reported copy changes nothing in the other. Models fix the copy the example hits,
     re-run the example and stop. Prefer a real one (Pattern A or B) over a planted one. Find
     candidates by searching for the low-level primitive across packages (redirect following,
     header copying, file writes, message construction). It only counts if the report never
     describes it.
2. **Pattern B: uncovered routes.**
   - Routes into the same protected sink where the advisory's own protection is missing at the
     pinned commit, and which the published fix did not touch.
   - They are unmodified upstream code. A solver may argue they were never covered, but the task's
     general property covers them, so leaving one open is a model failure, not out of scope. The
     same holds for a route where the protection never existed: the property requires it.
   - Make sure the property, read literally, really covers each route (no word that excludes it),
     and that its test fails only when the protection is really missing (it must pass a correct
     fix placed at any valid layer).
   - The strongest lever found so far: DeepSeek 6 of 6 on one; both models 0 of 3 on three combined.
3. **Shape traps: an input form that a plausible check mishandles.** Examples: a value given as an
   array where the check only handles a string; a name split on the first separator when it can
   contain the separator; a resolved path against a lexical check; a rename or rewrite that happens
   after the check; a nested expression the check never inspects. Two conditions: the general
   property must cover the form literally, and the form must not fall inside anything a
   must-keep-working clause or a test fixture calls legitimate. A pure spelling, encoding, verb,
   protocol or role variant of a stated input is NOT a shape trap: both models always catch those
   (see "Never add").
4. **A coupled must-keep-working behaviour** next to the sink, tested functionally, so an
   over-broad fix fails. MiMo tends to over-harden.
5. **Producer off the check's path.** The check depends on data produced elsewhere (a schema,
   serializer, cache, mapper, table builder or config loader) and does not call it; the data
   reaches the check on a separate path (saved and reloaded, rebuilt from config). The fix needs
   both the check and the producer. Models trace into what the check calls, never back to where
   its data comes from. Rules:
   - it counts only if the producer is infrastructure, not a request handler;
   - verify that the check does **not** call the producer; if it does, the model follows the call
     and fixes it;
   - the report describes impact only through the check's path and states the property abstractly
     ("including data saved earlier"); it never points at the producer or the reload path;
   - avoid fixes where the check cannot compile without the producer change (that forces the find);
   - hidden tests must not need a field or function name the solver would have to guess;
   - prefer a producer deep in internal machinery (a table or schema builder). One behind a path
     that is easy to follow falls as soon as anything points at it.
6. **Injected siblings**, only where the plan asks for them. Each must be:
   - code a maintainer could have written, with no deceptive names or comments;
   - reachable through the real entry point;
   - covered by the task's general property, never by a sentence of its own;
   - placed where the upstream fix never touches.
7. **Wrong object.** The authorization check exists but decides on a different object than the one
   the request actually touches: a neighbouring or proxy resource (a parent or container instead of
   the item written), or an identity field the caller supplies (an account inside a caller-provided
   resource name; a parent read from one part of the request while the write uses another). Models
   copy the nearby precedent. Rules:
   - the instruction names the protected object class in product terms ("the objects that hold the
     limits"), never the check or its location;
   - the security test denies exactly the object touched while the proxy object stays allowed;
   - a functional test keeps a legitimate request on that same object working.
8. **Ordering.** The check is right but runs at the wrong moment: after an adjustment turns the
   attacker's value into a different bad value (an offset, a clamp, a unit conversion, a
   normalisation), or after a side effect has already happened (a directory created, a file cleared,
   copied or re-permissioned, a request sent) before the refusal. Rules:
   - the instruction states the property over the attacker's input or the outcome ("nothing outside
     the folder is created or changed, even when the request is refused"), never the order of steps;
   - the security test checks the side effect itself, not only the response;
   - any fix that keeps the property passes, wherever it places the check.
9. **Route where the protection never existed.** Real code reaches the protected sink but never had
   the check at all, so its absence reads as design (DeepSeek missed one 6 of 6 times). Rules:
   - it needs a plausible reason to dismiss: an unsupported combination, a legacy path, a
     neighbouring feature. If the project documents the protection as applying everywhere with no
     exceptions, there is no reason to dismiss and the route adds nothing;
   - the general property must cover it literally; never describe it in the instruction;
   - confirm it with a behavioural test on the pinned copy, like any Pattern B route.
10. **Merged or defaults route.** The restricted value reaches the sink through defaults, a merge,
    inheritance, a patch, or stored configuration rather than the request field the report shows.
    Models treat the report's example fields as the whole set. Rules:
    - state the property over the sink ("anything a submitter supplies that ends up in X, however
      it gets there"), not over the entry or field;
    - the security test drives the merged or stored route through the real entry point;
    - a functional test keeps legitimate defaults and merges working.

Aim for at least two levers with **different** reasons to dismiss.

**At least one lever must be how-type**: its fix needs the mechanism understood, not only found.
How-type levers are a producer off the check's path (5), a coupled must-keep-working value (4), a
shape that a plausible check mishandles (3: a separator split, a rename after the check), and a
route where the protection never existed. Where-type levers (another entry point into the same code,
a second copy, injected siblings) only cost a search. They held only when the report stayed general,
so count them as extras, never as the task's main difficulty.

Never add:
- encoding, verb, protocol or role/direction variants;
- more routes of one concept;
- resource-exhaustion traps.

Every lever must be findable by a blind engineer from the report and the code. A lever that a blind
fix cannot find is unfair: remove it.

**Pattern B rules:**
- Confirm each route with a behavioural test on the pinned copy before relying on it. The
  screener's claim is only a lead.
- Append one row per route to `/home/mara/cwe-bench/build/audit/uncovered-routes.tsv`, using its existing
  header. Columns:
  - `task`, `repo`, `advisory`;
  - `trap_ref` (the manifest trap id only; no mechanism text, since the manifest holds the detail);
  - `real_upstream`;
  - `present_in_latest` (`yes`, `no` or `unknown`, from a read-only look at current upstream code if
    you can reach it);
  - `public_upstream_report`, `in_current_scope`, `built`, `note`;
  - `disclosure_status` (`pending client decision`).

## Environment (`tasks/authorizer-s4/environment/Dockerfile`)
- **Base and code.** A small official base image. The repo goes into `/app` at the pinned commit,
  and `/app/.git` is then deleted.
- **Offline.** Install every dependency, tool and service the project and tests need; nothing may
  be downloaded at test time. Services start from `test.sh`.
- **Packages:** `patch`, `curl`, `ca-certificates`, `bash`, `git`.
- **Agent layer.** Append `common/trial/claude-code.Dockerfile.snippet` unchanged at the end.
- **No test code in the image.** The agent shares the container. Pre-build against stubs; `test.sh`
  copies the real tests in at grading time.
- **Project tests.** The project's own tests for the affected area must pass in the image at the
  pinned commit.
- **No leaked regression tests.** The pinned commit must not already contain the advisory's
  regression tests (check `git log` between the pinned and fix commits).

## Report to the solver (`tasks/authorizer-s4/instruction.md`)
**Write:**
- what the system is, at product level;
- one observed impact, with ONE concrete trigger at user level (HTTP request, CLI call or public API
  use);
- the security property as an **invariant**, stated once in general terms: who may do what to which
  data, or what attacker input must never achieve ("no value of X may …, however it arrives"). It is
  fair when, read literally, it covers every tested route and shape; it must not point at any of
  them. Write a second property only for a genuinely different protection, never one per route,
  and never a count;
- every **contract** the tests need, each stated once for the whole product, never per route:
  - the refusal form ("a client error with no side effect");
  - any interface or field name a test uses, stated so it applies everywhere. If a sibling's test
    would need a contract that only that sibling uses, change the test so it does not, or drop the
    sibling;
  - preservation clauses ("everything that works today keeps working exactly as today"). Name a
    coupled legitimate value in property terms ("visible values keep binding even next to a hidden
    one"), not by the feature or route it sits on;
  - a legitimate magnitude next to any attack magnitude;
- that examples are examples, not the full set;
- the standard constraints block: fix the problem and its close variants; keep legitimate use
  working; do not look up the upstream fix; do not special-case the
  example.

**Never write:**
- file, package, function, class, field or parameter names a user would not see;
- line numbers, the root cause, the fix approach, or a CVE or GHSA id;
- a list of routes, spellings or roles;
- restricting adverbs ("directly", "only via");
- anything that names or paraphrases a far site, an uncovered route or an injected sibling;
- any clause that describes where a far site, uncovered route or injected sibling lives, even in
  product terms: no route, operation, command, channel, object kind, stage or format that points
  at one of them. State each property once, over the protected data or outcome, so it covers every
  route without pointing at any;
- a word that is general but is also the name of one stage or entry point ("loading" when the
  product has a load call). Pick wording that cannot be read as one surface.

Check before you finish: for each sentence of the report, ask whether it exists to cover one
specific route or trap. If it does, delete it or widen it into the general property.

Put every identifier that must not appear in `manifest.leak_terms`.

## Tests (`tasks/authorizer-s4/tests/`)
- **`security/`:** one test per site, route, input shape and form. Each one:
  - goes through the real entry point;
  - fails on the pinned code and passes on a correct fix;
  - asserts the attack is blocked: any client error plus no side effect, never one exact status.
- **`functional/`:**
  - legitimate use, including the coupled behaviour of every lever;
  - where they exist, the project's own tests for the area.
- **No product code in a test's bookkeeping.** Compute expected values and clean-ups in the test
  itself, because a hardened helper must not crash a test.
- **Stubs** of permission or authority answer per resource and verb, like the real thing.
- **Scope.** A test may vary only what the instruction names, and drive only the entry point it
  names.
- **No network**, and nothing that depends on the fix commit being present.
- **Templates.** JUnit XML into the two directories the template names. Copy `score.py` unchanged.
  Edit only the marked command lines of `test.sh`, and keep its agent-kill block.

## Proof
- **The oracle.** `solution/fix.patch` is the published fix reduced to source changes, plus fixes
  for every uncovered route and injected sibling in the task. `solution/solve.sh` applies it to
  `/app`.
- **Wrong-fix patches** go in `build/authorizer-s4/checks/`, listed in `manifest.patch_checks`:
  - one `security_fail` per lever (the fix that misses only that lever);
  - a `functional_fail` (an over-broad or feature-removing fix);
  - a `pass` of kind `hardening` (the oracle plus defensive hardening of the product code the
    security tests import);
  - a `pass` alternative fix where a second valid design is plausible.
- **`manifest.wrong_fix_catalogue`:** for each class, a `checks/` patch, or `n/a: <why>`:
  `refuse_all`, `crash_as_refusal`, `wrong_resource`, `one_role_or_direction`, `reads_only`,
  `check_after_adjustment`, `unlisted_route`, `malformed_identity`, `missing_authority`,
  `adjacent_api`.

## Deliverables
**`tasks/authorizer-s4/`:**
- `instruction.md`;
- `task.toml`, from `common/builder/templates/`, with `[metadata]` (incl. the delivery fields) filled in and
  `network_mode = "no-network"` (no allowlist);
- `environment/Dockerfile`;
- `solution/solve.sh` and `solution/fix.patch`;
- `tests/test.sh`, `tests/score.py`, `tests/security/` and `tests/functional/`.

**`build/authorizer-s4/manifest.json`:**
- `slug`, `candidate`;
- `pattern`: `A`;
- `builder_prompt_version`: `build-v1`;
- `"strict_gate": true`;
- `verified`: entry point, sites, routes, services, project tests run;
- `leak_terms`, `patch_checks`, `wrong_fix_catalogue`;
- `traps`: one entry per lever, with `shape`, `where` (file:line), `security_tests`,
  `coupled_functional_tests`, `security_fail_patch`, and `realistic_because` (for pattern B: "real,
  unmodified upstream code");
- `status`.

**Also in `build/authorizer-s4/`:**
- `checks/*.patch`;
- `notes.md`: start and end UTC, each lever in one line, what you verified, what you could not.

Pattern B: the register rows (see Design).

Use `common/builder/templates/` and `common/trial/smoke-task/` for the layout.

## Run the gate
Run the stages in order, one at a time:
```
python3 -I common/gate/gate.py authorizer-s4 --only static
python3 -I common/gate/gate.py authorizer-s4 --only nop
python3 -I common/gate/gate.py authorizer-s4 --only oracle
python3 -I common/gate/gate.py authorizer-s4 --only patches
```
In static, only the missing `blind` patch and the missing `FAIRNESS.md` may remain; others write
those after you. Do NOT write them yourself, and do NOT run trials or any target model.

## Machine and files
- **The machine:** one shared 8-CPU / 12 GB Docker VM that is running trials.
  - At most one Docker build or gate stage of yours at a time.
  - Never prune Docker images or the build cache.
  - Never stop containers you did not start.
- **Files:**
  - scratch work goes in `~/.tb-graders/cwe/work/authorizer-s4/`;
  - edit only `tasks/authorizer-s4/`, `build/authorizer-s4/` and, for pattern B, the register;
  - do not commit.

## Stop and report instead of shipping when
- the flaw does not reproduce through a real entry point at the pinned commit;
- a planned route or site is not reachable, or the check calls the producer directly (substitute
  another lever the code supports if you can, and say so);
- the task needs network at run time, or a GPU, kernel or GUI;
- the tests are flaky;
- no design meets the bar.

## Report back (under 400 words)
- The gate result for each stage.
- Each lever in one line: pattern, shape, file:line, reason to dismiss.
- Pattern B: each register row.
- The instruction's word count.
- Every guess you could not verify.
- Any fairness concern you see yourself.
- Anything noticed outside the scope, in one line.
- If abandoned, exactly why.
