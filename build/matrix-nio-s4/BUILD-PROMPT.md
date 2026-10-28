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

Project root: `/home/mara/cwe-bench`. Task: `matrix-nio-s4`. Pattern: `A`. Track: `injected`.

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
- Advisory: ["GHSA-WCHH-9X6H-7F6P"]; matrix-nio/matrix-nio; CWE-1395 dependency on a vulnerable third-party component: migration of the crypto backend from libolm/python-olm to vodozemac
- Pinned (vulnerable) commit: 13e77bb8fce48c4abc6fa7f334f1a797bf33052c. Published fix: 71a1c808bc2ae6ea2a6e8effa7c11bd09796c626.
- The screener's record (a lead to verify, not a fact):
  ```json
  {
 "screener_version": "screener-v2",
 "lessons_version": "lessons-v2",
 "model": "deepseek-flash[1m]",
 "entry_id": "6061",
 "advisory_ids": [
  "GHSA-WCHH-9X6H-7F6P"
 ],
 "repo": "matrix-nio/matrix-nio",
 "pinned_commit": "13e77bb8fce48c4abc6fa7f334f1a797bf33052c",
 "fix_commits": [
  "71a1c808bc2ae6ea2a6e8effa7c11bd09796c626"
 ],
 "trust_decision": {
  "summary": "All Olm/Megolm/SAS cryptography in nio is delegated to the third-party libolm library (python-olm); the advisory decides that nio must stop depending on it and run on vodozemac instead, and the fix re-implements every nio/crypto call site plus the on-disk pickle format, gated by the two package_installed(\"olm\") import switches.",
  "evidence": [
   "pyproject.toml:32",
   "src/nio/crypto/sessions.py:21",
   "src/nio/crypto/olm_machine.py:23",
   "src/nio/crypto/sas.py:23",
   "src/nio/crypto/__init__.py:23",
   "src/nio/store/__init__.py:18"
  ]
 },
 "landing_point": {
  "where": "pyproject.toml:28-33",
  "why": "The advisory summary is only 'olm dependency deprecation'; the first thing an engineer checks is the declared dependency (python-olm in the e2e extra), then the runtime switch src/nio/crypto/__init__.py:23 and the first import olm at src/nio/crypto/sessions.py:21."
 },
 "fix_sites": [
  {
   "where": "pyproject.toml:32",
   "entry_point": "pip install \"matrix-nio[e2e]\" / \"[dev]\"",
   "module_kind": "packaging manifest (dependency declaration)"
  },
  {
   "where": "src/nio/crypto/__init__.py:23",
   "entry_point": "import nio.crypto (sets ENCRYPTION_ENABLED and exports Olm/Sas/Session classes)",
   "module_kind": "package facade / import gate"
  },
  {
   "where": "src/nio/crypto/sessions.py:21-43",
   "entry_point": "nio.crypto.OlmAccount.from_pickle (public class export) and MatrixStore.load_account",
   "module_kind": "crypto backend wrapper / serializer"
  },
  {
   "where": "src/nio/crypto/sessions.py:52-168",
   "entry_point": "nio.crypto.Session / InboundSession / OutboundSession / InboundGroupSession (encrypt, decrypt, import_session)",
   "module_kind": "crypto backend wrapper (public API)"
  },
  {
   "where": "src/nio/crypto/sessions.py:171-201",
   "entry_point": "nio.crypto.OutboundGroupSession (group_encrypt on Client.room_send)",
   "module_kind": "crypto backend wrapper (public API)"
  },
  {
   "where": "src/nio/crypto/olm_machine.py:23-26",
   "entry_point": "nio.Client(...) with an encryption store: message encrypt/decrypt",
   "module_kind": "crypto engine (imports + exception types)"
  },
  {
   "where": "src/nio/crypto/olm_machine.py:275-276",
   "entry_point": "Client.should_upload_keys / Client.keys_upload (one-time-key count)",
   "module_kind": "crypto engine"
  },
  {
   "where": "src/nio/crypto/olm_machine.py:289-300",
   "entry_point": "Olm.share_keys (one-time-key generation on first upload)",
   "module_kind": "crypto engine"
  },
  {
   "where": "src/nio/crypto/olm_machine.py:371-382",
   "entry_point": "Olm._olm_encrypt -> Client.room_send / to-device encrypt",
   "module_kind": "crypto engine (encrypt sink, wire encoding)"
  },
  {
   "where": "src/nio/crypto/olm_machine.py:1475-1485",
   "entry_point": "Olm.decrypt_event -> Client.decrypt_event (to-device decrypt)",
   "module_kind": "crypto engine (decrypt sink, message construction)"
  },
  {
   "where": "src/nio/crypto/olm_machine.py:1495-1534",
   "entry_point": "Olm.decrypt -> Client.decrypt (session creation on pre-key message)",
   "module_kind": "crypto engine (decrypt sink)"
  },
  {
   "where": "src/nio/crypto/olm_machine.py:1857-1861",
   "entry_point": "Olm.verify_signed_json (device key / cross-signing verification on sync)",
   "module_kind": "signature verification"
  },
  {
   "where": "src/nio/crypto/olm_machine.py:1912-1927",
   "entry_point": "Client.import_keys -> Olm._import_group_session",
   "module_kind": "key import (public API)"
  },
  {
   "where": "src/nio/crypto/sas.py:46",
   "entry_point": "Client.create_sas / Client.get_active_sas (SAS device verification)",
   "module_kind": "verification state machine"
  },
  {
   "where": "src/nio/crypto/sas.py:247",
   "entry_point": "Sas.from_key_verification_start (commitment hash)",
   "module_kind": "verification state machine"
  },
  {
   "where": "src/nio/crypto/sas.py:337",
   "entry_point": "Sas._check_commitment (commitment verification)",
   "module_kind": "verification state machine"
  },
  {
   "where": "src/nio/store/__init__.py:18",
   "entry_point": "from nio.store import DefaultStore, SqliteMemoryStore, MatrixStore",
   "module_kind": "store package import gate"
  },
  {
   "where": "src/nio/store/database.py:170-183",
   "entry_point": "MatrixStore.load_account (Client.__init__ encryption setup)",
   "module_kind": "persistence / serializer"
  },
  {
   "where": "src/nio/store/database.py:210-228",
   "entry_point": "MatrixStore.load_sessions (Client.__init__ encryption setup)",
   "module_kind": "persistence / serializer"
  },
  {
   "where": "src/nio/store/database.py:252-277",
   "entry_point": "MatrixStore.load_inbound_group_sessions (Client.export_keys, decrypt after restart)",
   "module_kind": "persistence / serializer"
  }
 ],
 "O1_entry_points": 5,
 "O2_out_of_scope_site": {
  "kind": "save_reload_or_serialization",
  "where": "src/nio/store/database.py:170-183"
 },
 "O3_reason_to_dismiss": "The loader already falls back to libolm pickles, so rewriting the stored pickles into vodozemac format is only an optimisation - decryption keeps working if the store layer is left alone.",
 "O4_distance": {
  "files": 3,
  "packages": 1,
  "repo_mb": null
 },
 "O5_coupled_behaviour": {
  "what": "Accounts and sessions already persisted in libolm pickle format must keep loading with the same identity keys, so the fix deliberately keeps an olm fallback for pickle versions below 4 instead of removing libolm outright; a fix that simply stops importing olm logs existing users out of their encrypted rooms.",
  "where": "fix.diff:612-626; src/nio/store/database.py:170-183"
 },
 "O6_input_shapes": [
  "account pickle: vodozemac format, libolm v4 format, and pre-v4 libolm format that only the olm package can re-pickle (fix.diff:598-627)",
  "olm session pickle: vodozemac format and libolm v1 format (fix.diff:700-721)",
  "inbound group session pickle: vodozemac format and libolm format (fix.diff:891-928)",
  "outbound group session pickle: vodozemac format only (fix.diff:978-983)",
  "ciphertext body: unpadded-base64 wire string vs raw bytes (fix.diff:88-99 and fix.diff:193-207)",
  "olm message type 0 (pre-key) vs type 1 (normal) on decrypt (src/nio/crypto/olm_machine.py:1475-1485)",
  "one-time-key count: full max_one_time_keys vs half of it (src/nio/crypto/olm_machine.py:275-276)"
 ],
 "O7_producer": {
  "kind": "serializer",
  "where": "src/nio/store/database.py:186-207",
  "check_calls_producer": false
 },
 "O8_uncovered_routes": [
  {
   "route": "Shipped Docker image builds libolm from source (LIBOLM_VERSION=3.2.11) and copies libolm* into the runtime container, so deployments still carry the vulnerable library.",
   "where": "docker/Dockerfile:33-49",
   "reason_to_dismiss": "Docker/e2e build files, not library source; the advisory is about the Python dependency and the e2e extra.",
   "distance": "outside src/, docker/ directory (same repo)",
   "present_in_latest": "unknown",
   "latest_where": ""
  },
  {
   "route": "libolm build helper cloned and installed by the Dockerfile; nothing else in the tree installs libolm.",
   "where": "docker/build_and_install_libolm.sh:18-32",
   "reason_to_dismiss": "A shell helper for the e2e image; a solver can call it CI plumbing rather than code that reaches the crypto sink.",
   "distance": "outside src/, docker/ directory (same repo)",
   "present_in_latest": "unknown",
   "latest_where": ""
  },
  {
   "route": "Arch Linux package recipe declares python-olm as a runtime dependency, so distro installs still pull libolm.",
   "where": "contrib/archlinux/pkgbuild/PKGBUILD.git:16",
   "reason_to_dismiss": "Third-party packaging recipe maintained separately; not built or tested by this project.",
   "distance": "outside src/, contrib/ directory (same repo)",
   "present_in_latest": "unknown",
   "latest_where": ""
  }
 ],
 "O8b_injection_room": [
  {
   "where": "src/nio/crypto/sessions.py:171-201",
   "sibling": "A second pickle producer/consumer for OutboundGroupSession: it already carries rotation state (max_age, max_messages, message_count) but is never persisted at the pinned commit.",
   "why_realistic": "Persisting the outbound group session across restarts is an obvious follow-up, and the fix itself adds an OutboundGroupSession.from_pickle with no libolm branch (fix.diff:978-983), so the same format-migration check would be missing there."
  },
  {
   "where": "src/nio/store/database.py:307-329",
   "sibling": "A second store backend that pickles device keys or pending key requests, duplicating the load-time format upgrade.",
   "why_realistic": "MatrixStore is a documented extension point (src/nio/store/__init__.py:9-11) with DefaultStore/SqliteStore/SqliteMemoryStore already subclassing it, so a maintainer adding a backend would copy the load_* pickling and could forget the vodozemac migration."
  },
  {
   "where": "src/nio/crypto/key_export.py:26-46",
   "sibling": "A passphrase-protected file serializer next to the sink, as an alternative to the sqlite pickle store.",
   "why_realistic": "The project already ships a second serialization boundary for encryption state (key export/import with PBKDF2), and a maintainer could move account or session blobs into that file, needing the same pickle-key derivation as derive_pickle_key."
  }
 ],
 "O9_family": "CWE-1395 dependency on a vulnerable third-party component: migration of the crypto backend from libolm/python-olm to vodozemac",
 "O9_dos": false,
 "O10_build": {
  "language": "Python",
  "toolchain": "setuptools / PEP 517 via pyproject.toml, pytest + tox (tox.ini:5-10); pinned commit needs the olm C library and python-olm built with cmake (docker/build_and_install_libolm.sh), the fix needs the vodozemac wheel instead",
  "services": [],
  "offline_after_build": true,
  "project_tests": "tests/encryption_test.py, tests/sessions_test.py, tests/sas_test.py, tests/store_test.py, tests/key_export_test.py - pytest against ephemeral sqlite stores and local test data, no network"
 },
 "O11_fix_minutes": 300,
 "O12_red_flags": [],
 "O13_recall_risk": "high",
 "pattern_fit": "A",
 "j": {
  "j_multi_site": 1,
  "j_sites_touched": "pyproject.toml; src/nio/crypto/__init__.py; src/nio/crypto/olm_machine.py; src/nio/crypto/sas.py; src/nio/crypto/sessions.py; src/nio/store/__init__.py; src/nio/store/database.py",
  "j_sibling_sites": "yes",
  "j_cause_other_layer": 1,
  "j_defence_ineffective": 0,
  "j_overbroad_breaks_legit": 1,
  "j_tempting_wrong_fix": "Swap python-olm for vodozemac in the two import gates and pyproject.toml and port the obvious call sites, leaving stored libolm pickles unconverted and the store layer untouched."
 },
 "out_of_scope_notes": [
  "CVE-2022-39255 and CVE-2024-45193 are flaws inside the third-party libolm C library, outside this repository; not examined."
 ],
 "unverified": [
  "repo_mb: directory size could not be measured without a shell; source tree is roughly 70 .py files so it is probably under 5 MB, which would be a tiny_repo red flag, but the threshold is unchecked.",
  "O7 check_calls_producer: the fix's own new tests do read stored rows via DefaultStore._get_account (fix.diff:1174-1175, fix.diff:1280-1281), so a store-level check would call the producer; whether a hidden behavioural check does is unknown.",
  "O8 present_in_latest: the input says the latest release for O8 is 'none', so presence of the docker/contrib routes in current code is unknown.",
  "Whether vodozemac 0.9 exposes an equivalent for every libolm behaviour used here (e.g. the old hmac-sha256 SAS MAC, which the fix drops) was not checked, since no network or installed packages were used."
 ]
}
  ```
- Published fix sites:   - pyproject.toml:32 — entry point: pip install "matrix-nio[e2e]" / "[dev]" [packaging manifest (dependency declaration)]
  - src/nio/crypto/__init__.py:23 — entry point: import nio.crypto (sets ENCRYPTION_ENABLED and exports Olm/Sas/Session classes) [package facade / import gate]
  - src/nio/crypto/sessions.py:21-43 — entry point: nio.crypto.OlmAccount.from_pickle (public class export) and MatrixStore.load_account [crypto backend wrapper / serializer]
  - src/nio/crypto/sessions.py:52-168 — entry point: nio.crypto.Session / InboundSession / OutboundSession / InboundGroupSession (encrypt, decrypt, import_session) [crypto backend wrapper (public API)]
  - src/nio/crypto/sessions.py:171-201 — entry point: nio.crypto.OutboundGroupSession (group_encrypt on Client.room_send) [crypto backend wrapper (public API)]
  - src/nio/crypto/olm_machine.py:23-26 — entry point: nio.Client(...) with an encryption store: message encrypt/decrypt [crypto engine (imports + exception types)]
  - src/nio/crypto/olm_machine.py:275-276 — entry point: Client.should_upload_keys / Client.keys_upload (one-time-key count) [crypto engine]
  - src/nio/crypto/olm_machine.py:289-300 — entry point: Olm.share_keys (one-time-key generation on first upload) [crypto engine]
  - src/nio/crypto/olm_machine.py:371-382 — entry point: Olm._olm_encrypt -> Client.room_send / to-device encrypt [crypto engine (encrypt sink, wire encoding)]
  - src/nio/crypto/olm_machine.py:1475-1485 — entry point: Olm.decrypt_event -> Client.decrypt_event (to-device decrypt) [crypto engine (decrypt sink, message construction)]
  - src/nio/crypto/olm_machine.py:1495-1534 — entry point: Olm.decrypt -> Client.decrypt (session creation on pre-key message) [crypto engine (decrypt sink)]
  - src/nio/crypto/olm_machine.py:1857-1861 — entry point: Olm.verify_signed_json (device key / cross-signing verification on sync) [signature verification]
  - src/nio/crypto/olm_machine.py:1912-1927 — entry point: Client.import_keys -> Olm._import_group_session [key import (public API)]
  - src/nio/crypto/sas.py:46 — entry point: Client.create_sas / Client.get_active_sas (SAS device verification) [verification state machine]
  - src/nio/crypto/sas.py:247 — entry point: Sas.from_key_verification_start (commitment hash) [verification state machine]
  - src/nio/crypto/sas.py:337 — entry point: Sas._check_commitment (commitment verification) [verification state machine]
  - src/nio/store/__init__.py:18 — entry point: from nio.store import DefaultStore, SqliteMemoryStore, MatrixStore [store package import gate]
  - src/nio/store/database.py:170-183 — entry point: MatrixStore.load_account (Client.__init__ encryption setup) [persistence / serializer]
  - src/nio/store/database.py:210-228 — entry point: MatrixStore.load_sessions (Client.__init__ encryption setup) [persistence / serializer]
  - src/nio/store/database.py:252-277 — entry point: MatrixStore.load_inbound_group_sessions (Client.export_keys, decrypt after restart) [persistence / serializer]
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

## Environment (`tasks/matrix-nio-s4/environment/Dockerfile`)
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

## Report to the solver (`tasks/matrix-nio-s4/instruction.md`)
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

## Tests (`tasks/matrix-nio-s4/tests/`)
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
- **Wrong-fix patches** go in `build/matrix-nio-s4/checks/`, listed in `manifest.patch_checks`:
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
**`tasks/matrix-nio-s4/`:**
- `instruction.md`;
- `task.toml`, from `common/builder/templates/`, with `[metadata]` (incl. the delivery fields) filled in and
  `network_mode = "no-network"` (no allowlist);
- `environment/Dockerfile`;
- `solution/solve.sh` and `solution/fix.patch`;
- `tests/test.sh`, `tests/score.py`, `tests/security/` and `tests/functional/`.

**`build/matrix-nio-s4/manifest.json`:**
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

**Also in `build/matrix-nio-s4/`:**
- `checks/*.patch`;
- `notes.md`: start and end UTC, each lever in one line, what you verified, what you could not.

Pattern B: the register rows (see Design).

Use `common/builder/templates/` and `common/trial/smoke-task/` for the layout.

## Run the gate
Run the stages in order, one at a time:
```
python3 -I common/gate/gate.py matrix-nio-s4 --only static
python3 -I common/gate/gate.py matrix-nio-s4 --only nop
python3 -I common/gate/gate.py matrix-nio-s4 --only oracle
python3 -I common/gate/gate.py matrix-nio-s4 --only patches
```
In static, only the missing `blind` patch and the missing `FAIRNESS.md` may remain; others write
those after you. Do NOT write them yourself, and do NOT run trials or any target model.

## Machine and files
- **The machine:** one shared 8-CPU / 12 GB Docker VM that is running trials.
  - At most one Docker build or gate stage of yours at a time.
  - Never prune Docker images or the build cache.
  - Never stop containers you did not start.
- **Files:**
  - scratch work goes in `~/.tb-graders/cwe/work/matrix-nio-s4/`;
  - edit only `tasks/matrix-nio-s4/`, `build/matrix-nio-s4/` and, for pattern B, the register;
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
