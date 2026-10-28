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

Project root: `/home/mara/cwe-bench`. Task: `baileys-s4`. Pattern: `B`. Track: `injected`.

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
- Advisory: ["GHSA-QVV5-JQ5G-4CGG", "CVE-2026-48063"]; whiskeysockets/baileys; origin-validation / spoofing of control-plane protocol messages (CWE-290, CWE-345, CWE-346) leading to local state and app-state corruption
- Pinned (vulnerable) commit: 28ca087cf1cbe3c05a5b704d67b3e2270d647b74. Published fix: 3beb08eecfcb4e65722e674034bd84fb11a9de35.
- The screener's record (a lead to verify, not a fact):
  ```json
  {
 "screener_version": "screener-v2",
 "lessons_version": "lessons-v2",
 "model": "deepseek-flash[1m]",
 "entry_id": "13449",
 "advisory_ids": [
  "GHSA-QVV5-JQ5G-4CGG",
  "CVE-2026-48063"
 ],
 "repo": "whiskeysockets/baileys",
 "pinned_commit": "28ca087cf1cbe3c05a5b704d67b3e2270d647b74",
 "fix_commits": [
  "3beb08eecfcb4e65722e674034bd84fb11a9de35"
 ],
 "trust_decision": {
  "summary": "Whether a protocolMessage of a type that only our own phone/other own devices may send (HISTORY_SYNC_NOTIFICATION, APP_STATE_SYNC_KEY_SHARE, LID_MIGRATION_MAPPING_SYNC, PEER_DATA_OPERATION_REQUEST_RESPONSE_MESSAGE) may mutate local state is decided per message at the single protocolMessage dispatcher, by a new SELF_ONLY_TYPES set membership test on protocolMsg.type combined with message.key.fromMe.",
  "evidence": [
   "src/Utils/process-message.ts:331-332",
   "src/Utils/process-message.ts:333",
   "fix.diff:33-50",
   "src/Utils/process-message.ts:380-403",
   "src/Utils/process-message.ts:505-521"
  ]
 },
 "landing_point": {
  "where": "src/Utils/process-message.ts:331",
  "why": "The advisory summary says a maliciously crafted protocolMessage payload causes message upsert / hist-sync spoofing and app-state corruption; the only code that dispatches protocolMessage.type to local state is this switch."
 },
 "fix_sites": [
  {
   "where": "src/Utils/process-message.ts:331-332",
   "entry_point": "makeWASocket inbound message pipeline: CB:message -> handleMessage -> upsertMessage -> processMessage (src/Socket/messages-recv.ts:1999, src/Socket/messages-recv.ts:1775, src/Socket/chats.ts:1310); second inbound path is the newsletter plaintext notification, CB:notification type=newsletter -> handleNewsletterNotification (src/Socket/messages-recv.ts:1042-1043, src/Socket/messages-recv.ts:511-529) which also calls upsertMessage",
   "module_kind": "message-processing utility (src/Utils), called only from src/Socket/chats.ts:1310"
  }
 ],
 "O1_entry_points": 2,
 "O2_out_of_scope_site": {
  "kind": "none",
  "where": ""
 },
 "O3_reason_to_dismiss": "For the O8 route a solver can say the sync state machine in upsertMessage is only lifecycle bookkeeping (when to flush, when to resync) while the history payload itself is processed and now dropped inside processMessage, so a stranger's notification 'cannot reach the sink'.",
 "O4_distance": {
  "files": 2,
  "packages": 0,
  "repo_mb": null
 },
 "O5_coupled_behaviour": {
  "what": "Protocol message types that legitimately arrive from other users must keep being applied: REVOKE, MESSAGE_EDIT, EPHEMERAL_SETTING, GROUP_MEMBER_LABEL_CHANGE; an over-broad 'drop every protocolMessage when !fromMe' (or a type allowlist error) silently stops other users' deletes and edits, and also stops our own phone's history sync / PDO response, which arrive with fromMe=true.",
  "where": "src/Utils/process-message.ts:404-420, src/Utils/process-message.ts:474-504, fix.diff:23-26"
 },
 "O6_input_shapes": [
  "protocolMessage.type restricted to the four self-only enum values while four other types in the same field must still run for strangers (fix.diff:33-38, fix.diff:23-26)",
  "protocolMsg.type null/undefined, i.e. proto3 unset type (fix.diff:39-42)",
  "sender origin flag message.key.fromMe true vs false (fix.diff:43)",
  "protocolMessage nested inside wrapper content (ephemeralMessage, viewOnceMessage, documentWithCaptionMessage, editedMessage, associatedChildMessage, groupStatusMessage*) because the guard runs on the normalizeMessageContent output (src/Utils/process-message.ts:322, src/Utils/messages.ts:805-817)",
  "deviceSentMessage-wrapped protocolMessage: unwrapped before dispatch, so the envelope's fromMe decides (src/Utils/decode-wa-message.ts:335)"
 ],
 "O7_producer": {
  "kind": "mapper",
  "where": "src/Utils/decode-wa-message.ts:141-236 (fromMe derived at :187-189, :206, :214-216 and stored in the key at :223-236), invoked from src/Utils/decode-wa-message.ts:264",
  "check_calls_producer": false
 },
 "O8_uncovered_routes": [
  {
   "route": "A non-self HISTORY_SYNC_NOTIFICATION still drives upsertMessage's history-sync state machine: sets initialBootstrapComplete/recentSyncComplete, emits messaging-history.status, runs resyncAppState(ALL_WA_PATCH_NAMES, true) and ev.flush(), with no fromMe check; the fix only returns early inside processMessage, after this code already ran.",
   "where": "src/Socket/chats.ts:1213-1217",
   "reason_to_dismiss": "It only decides when to flush the event buffer and when to start an app-state resync; the attacker-supplied history payload itself is processed in processMessage and is now dropped there.",
   "distance": "same package, different directory: src/Utils (landing point) to src/Socket, one hop from the sink's only caller; the state machine is at src/Socket/chats.ts:1219-1301",
   "present_in_latest": "unknown",
   "latest_where": ""
  },
  {
   "route": "A non-self APP_STATE_SYNC_KEY_SHARE still triggers a full app-state resync (doAppStateSync -> resyncAppState(ALL_WA_PATCH_NAMES)) whenever syncState === Syncing; only the key storage inside processMessage is guarded.",
   "where": "src/Socket/chats.ts:1324-1327",
   "reason_to_dismiss": "The key itself is rejected by the new guard, and reacting to a key-share with a sync is needed for our own devices' key share, so the envelope check looks unnecessary here.",
   "distance": "src/Utils/process-message.ts to src/Socket/chats.ts, second consumer in the caller file of the guarded function",
   "present_in_latest": "unknown",
   "latest_where": ""
  }
 ],
 "O8b_injection_room": [
  {
   "where": "src/Utils/process-message.ts:380-403",
   "sibling": "Keep SELF_ONLY_TYPES membership but let the APP_STATE_SYNC_KEY_SHARE branch write keys and emit creds.update myAppStateKeyId for non-self senders, or guard only the history case.",
   "why_realistic": "The switch already hand-rolls per-type state writes, so a maintainer adding the guard for the type named in the report would plausibly leave the neighbouring branch as-is."
  },
  {
   "where": "src/Utils/process-message.ts:421-473",
   "sibling": "A PDO response branch that still emits messages.upsert with a fully attacker-chosen WAMessage key/bytes while the guard covers only the state writes.",
   "why_realistic": "This branch re-emits a whole decoded WebMessageInfo; guarding the key store but not the re-emitted upsert is a natural partial fix."
  },
  {
   "where": "src/Socket/messages-recv.ts:511-529",
   "sibling": "A per-route origin check for the newsletter plaintext path, which builds a WAMessage with a hardcoded fromMe:false from arbitrary publisher bytes.",
   "why_realistic": "It is a second, unencrypted message constructor outside the Signal pipeline, so a handler-level fix (rather than a sink-level one) would either duplicate or omit the check here."
  },
  {
   "where": "src/Socket/chats.ts:1324-1327",
   "sibling": "An origin check before the appStateSyncKeyShare-triggered resync, mirroring the processMessage guard in the caller.",
   "why_realistic": "The sync trigger lives in the caller next to the state machine and was written before the guard existed, so the same check is needed twice."
  },
  {
   "where": "src/Socket/messages-recv.ts:1604-1618",
   "sibling": "LID-PN mapping writes plus migrateSession from an unverified envelope participantAlt claim, next to the LID_MIGRATION_MAPPING_SYNC writes at src/Utils/process-message.ts:505-521.",
   "why_realistic": "Both feed the same signalRepository.lidMapping store and session migration, so a maintainer could plausibly add the same origin check to the envelope path."
  }
 ],
 "O9_family": "origin-validation / spoofing of control-plane protocol messages (CWE-290, CWE-345, CWE-346) leading to local state and app-state corruption",
 "O9_dos": false,
 "O10_build": {
  "language": "TypeScript (ESM)",
  "toolchain": "node >=20 (package.json:136-138), yarn 4, npm run build = tsc -P tsconfig.build.json + tsc-esm-fix (package.json:26); native deps libsignal and whatsapp-rust-bridge, optional peers sharp/jimp/link-preview-js",
  "services": [],
  "offline_after_build": true,
  "project_tests": "jest, npm test with testMatch '**/*.test.ts' (package.json:39). No test covers this origin guard: src/__tests__/Utils/process-message.test.ts only exercises cleanMessage/getChatId, src/__tests__/Utils/history.test.ts only processHistoryMessage; the fix diff adds no tests. Socket-level tests run offline through the mocked WS (src/__tests__/TestUtils/session.ts:33-47). A history payload must be supplied as initialHistBootstrapInlinePayload (src/Utils/history.ts:148-149) to avoid downloadHistory, which needs network (src/Utils/history.ts:151)."
 },
 "O11_fix_minutes": 45,
 "O12_red_flags": [],
 "O13_recall_risk": "medium",
 "pattern_fit": "B",
 "j": {
  "j_multi_site": 1,
  "j_sites_touched": "src/Utils/process-message.ts",
  "j_sibling_sites": "yes",
  "j_cause_other_layer": 1,
  "j_defence_ineffective": 0,
  "j_overbroad_breaks_legit": 1,
  "j_tempting_wrong_fix": "Put `if (!message.key.fromMe) return` at the top of the protocolMessage block (which kills other users' revokes/edits) or guard only the HISTORY_SYNC_NOTIFICATION case named in the report, and never look at upsertMessage's history-sync state machine in src/Socket/chats.ts."
 },
 "out_of_scope_notes": [
  "Nearby but a different mechanism, not pursued: LID-PN mapping writes plus migrateSession from unverified envelope participantAlt claims at src/Socket/messages-recv.ts:1604-1618 and src/Socket/messages-recv.ts:422-437 are not protocolMessage-driven and are outside this advisory's property."
 ],
 "unverified": [
  "repo size in MB: no shell available in this session, so repo_mb is null and tiny_repo/giant_repo cannot be judged.",
  "present_in_latest for the O8 routes: no latest release tree was supplied (latest = none), so answered unknown.",
  "Runtime reachability of a spoofed HISTORY_SYNC_NOTIFICATION while syncState === Syncing was established by reading src/Socket/chats.ts:1270-1301 and the default shouldSyncHistoryMessage (src/Defaults/index.ts:78-80), not by running anything.",
  "Whether upstream added tests for the guard in a later commit: the supplied fix diff contains no test changes."
 ]
}
  ```
- Published fix sites:   - src/Utils/process-message.ts:331-332 — entry point: makeWASocket inbound message pipeline: CB:message -> handleMessage -> upsertMessage -> processMessage (src/Socket/messages-recv.ts:1999, src/Socket/messages-recv.ts:1775, src/Socket/chats.ts:1310); second inbound path is the newsletter plaintext notification, CB:notification type=newsletter -> handleNewsletterNotification (src/Socket/messages-recv.ts:1042-1043, src/Socket/messages-recv.ts:511-529) which also calls upsertMessage [message-processing utility (src/Utils), called only from src/Socket/chats.ts:1310]
- Uncovered routes to confirm (pattern B):   - src/Socket/chats.ts:1213-1217 — A non-self HISTORY_SYNC_NOTIFICATION still drives upsertMessage's history-sync state machine: sets initialBootstrapComplete/recentSyncComplete, emits messaging-history.status, runs resyncAppState(ALL_WA_PATCH_NAMES, true) and ev.flush(), with no fromMe check; the fix only returns early inside processMessage, after this code already ran. (reason to dismiss: It only decides when to flush the event buffer and when to start an app-state resync; the attacker-supplied history payload itself is processed in processMessage and is now dropped there.; still in latest: unknown)
  - src/Socket/chats.ts:1324-1327 — A non-self APP_STATE_SYNC_KEY_SHARE still triggers a full app-state resync (doAppStateSync -> resyncAppState(ALL_WA_PATCH_NAMES)) whenever syncState === Syncing; only the key storage inside processMessage is guarded. (reason to dismiss: The key itself is rejected by the new guard, and reacting to a key-share with a sync is needed for our own devices' key share, so the envelope check looks unnecessary here.; still in latest: unknown)
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

## Environment (`tasks/baileys-s4/environment/Dockerfile`)
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

## Report to the solver (`tasks/baileys-s4/instruction.md`)
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

## Tests (`tasks/baileys-s4/tests/`)
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
- **Wrong-fix patches** go in `build/baileys-s4/checks/`, listed in `manifest.patch_checks`:
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
**`tasks/baileys-s4/`:**
- `instruction.md`;
- `task.toml`, from `common/builder/templates/`, with `[metadata]` (incl. the delivery fields) filled in and
  `network_mode = "no-network"` (no allowlist);
- `environment/Dockerfile`;
- `solution/solve.sh` and `solution/fix.patch`;
- `tests/test.sh`, `tests/score.py`, `tests/security/` and `tests/functional/`.

**`build/baileys-s4/manifest.json`:**
- `slug`, `candidate`;
- `pattern`: `B`;
- `builder_prompt_version`: `build-v1`;
- `"strict_gate": true`;
- `verified`: entry point, sites, routes, services, project tests run;
- `leak_terms`, `patch_checks`, `wrong_fix_catalogue`;
- `traps`: one entry per lever, with `shape`, `where` (file:line), `security_tests`,
  `coupled_functional_tests`, `security_fail_patch`, and `realistic_because` (for pattern B: "real,
  unmodified upstream code");
- `status`.

**Also in `build/baileys-s4/`:**
- `checks/*.patch`;
- `notes.md`: start and end UTC, each lever in one line, what you verified, what you could not.

Pattern B: the register rows (see Design).

Use `common/builder/templates/` and `common/trial/smoke-task/` for the layout.

## Run the gate
Run the stages in order, one at a time:
```
python3 -I common/gate/gate.py baileys-s4 --only static
python3 -I common/gate/gate.py baileys-s4 --only nop
python3 -I common/gate/gate.py baileys-s4 --only oracle
python3 -I common/gate/gate.py baileys-s4 --only patches
```
In static, only the missing `blind` patch and the missing `FAIRNESS.md` may remain; others write
those after you. Do NOT write them yourself, and do NOT run trials or any target model.

## Machine and files
- **The machine:** one shared 8-CPU / 12 GB Docker VM that is running trials.
  - At most one Docker build or gate stage of yours at a time.
  - Never prune Docker images or the build cache.
  - Never stop containers you did not start.
- **Files:**
  - scratch work goes in `~/.tb-graders/cwe/work/baileys-s4/`;
  - edit only `tasks/baileys-s4/`, `build/baileys-s4/` and, for pattern B, the register;
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
