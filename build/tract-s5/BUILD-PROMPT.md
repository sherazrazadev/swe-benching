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

Project root: `/home/mara/cwe-bench`. Task: `tract-s5`. Pattern: `B`. Track: `injected`.

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
- Advisory: ["GHSA-X5MV-8WGW-29HG", "CVE-2026-55093", "RUSTSEC-2026-0217"]; sonos/tract; CWE-190 integer overflow in a header-derived size computation, leading to CWE-125 out-of-bounds read on model load
- Pinned (vulnerable) commit: bee4349bee53862f52e4db13fb2ee0278770c94d. Published fix: 34c7df2c9bd2a36583e09b52f3e6319bf23102e8.
- The screener's record (a lead to verify, not a fact):
  ```json
  {
 "screener_version": "screener-v2",
 "lessons_version": "lessons-v2",
 "model": "deepseek-flash[1m]",
 "entry_id": "21634",
 "advisory_ids": [
  "GHSA-X5MV-8WGW-29HG",
  "CVE-2026-55093",
  "RUSTSEC-2026-0217"
 ],
 "repo": "sonos/tract",
 "pinned_commit": "bee4349bee53862f52e4db13fb2ee0278770c94d",
 "fix_commits": [
  "34c7df2c9bd2a36583e09b52f3e6319bf23102e8"
 ],
 "trust_decision": {
  "summary": "The `.dat` header (rank plus up to 8 `u32` dims) is attacker-controlled; whether the dims fit a `usize` element count, and the resulting bit/byte size, must be decided before any allocation. The published fix makes that decision in `read_tensor` at nnef/src/tensors.rs:64-79 with `checked_mul` and a bail, but leaves the allocate-time byte arithmetic and the block-quant branch's own multiply unchecked.",
  "evidence": [
   "nnef/src/tensors.rs:62-64",
   "nnef/src/tensors.rs:66-79",
   "nnef/src/tensors.rs:142-146",
   "nnef/src/tensors.rs:284-287",
   "data/src/tensor.rs:282",
   "fix.diff:13-16",
   "fix.diff:30-32"
  ]
 },
 "landing_point": {
  "where": "nnef/src/tensors.rs:64",
  "why": "The summary names an integer overflow in the NNEF `.dat` tensor parser; the first unchecked product over header-derived dims an engineer sees is `shape.iter().product::<usize>()` in `read_tensor`, the exact line the fix's first hunk rewrites."
 },
 "fix_sites": [
  {
   "where": "nnef/src/tensors.rs:64-67",
   "entry_point": "tract_nnef::tensors::read_tensor (pub, nnef/src/lib.rs:13); also reached by DatLoader on model load (nnef/src/resource.rs:98) and by the CLI --input-from-nnef path (cli/src/params.rs:423,426)",
   "module_kind": "public deserialization module (.dat tensor parser, nnef crate)"
  },
  {
   "where": "nnef/src/tensors.rs:78",
   "entry_point": "tract_nnef::tensors::read_tensor, plain/quantized item-type branch",
   "module_kind": "public deserialization module (.dat tensor parser, nnef crate)"
  }
 ],
 "O1_entry_points": 3,
 "O2_out_of_scope_site": {
  "kind": "none",
  "where": ""
 },
 "O3_reason_to_dismiss": "Block-quant item types 0x2040/0x3040/0x3080 are an internal GGML-style tract extension, so a solver can argue the advisory covers only the plain NNEF tensor types the report names, and the allocator's byte-count multiply in tract-data can be dismissed as shared core code used by every op rather than the parser.",
 "O4_distance": {
  "files": 1,
  "packages": 1,
  "repo_mb": null
 },
 "O5_coupled_behaviour": {
  "what": "Legitimate block-quant and string `.dat` tensors set `bits_per_item = u32::MAX`, which deliberately skips the byte-size comparison at :77-79; the writer emits exactly that for String (nnef/src/tensors.rs:218-221) and for block quant (nnef/src/tensors.rs:311-315). An over-broad fix that demands `len * bytes_per_item == data_size_bytes` for every tensor rejects every quantized or string tensor tract writes; the 1-byte slack for bool/1-bit tensors at :69 must also be preserved.",
  "where": "nnef/src/tensors.rs:77-79"
 },
 "O6_input_shapes": [
  "rank 0 (empty dims -> product 1)",
  "rank 1..8 with dims up to u32::MAX",
  "zero-length dims (product 0)",
  "element-count product overflowing usize (caught by the new try_fold)",
  "subsequent overflow in len * bits_per_item (bool, item_type 5)",
  "subsequent overflow in len * (bits_per_item / 8) (plain item types)"
 ],
 "O7_producer": {
  "kind": "serializer",
  "where": "nnef/src/tensors.rs:43-58 (Header::read; called from read_tensor at nnef/src/tensors.rs:62)",
  "check_calls_producer": true
 },
 "O8_uncovered_routes": [
  {
   "route": "Block-quant `.dat` header (item_type 0x3080): read_block_quant_value recomputes expected_len = (q_m*q_k)/block_len*block_bytes with plain arithmetic; a shape whose element count fits usize but whose block-byte size wraps can still match the u32 data_size_bytes and yields a short Blob for a huge logical shape, with the identical unchecked expression at linalg/src/frame/block_quant/storage.rs:21 so the constructor's `ensure!` passes too.",
   "where": "nnef/src/tensors.rs:284-287",
   "reason_to_dismiss": "Block-quant item types are an internal GGML-style tract extension (and the reader here already disagrees with the writer's 0x3081), so this branch can be argued never to have been in the advisory's scope.",
   "distance": "same file, about 220 lines below the landing point; separate branch entered at nnef/src/tensors.rs:142-146",
   "present_in_latest": "unknown",
   "latest_where": ""
  },
  {
   "route": "String `.dat` tensor: with bits_per_item = u32::MAX both size checks at :66-86 are skipped, and Tensor::zero_dt -> uninitialized_aligned_dt computes bytes = shape.product() * dt.size_of() with a plain `*` (data/src/tensor.rs:282); a smooth element count whose byte count wraps gives a short Blob for a huge shape, and as_slice_mut then builds a slice of `len` items over it (data/src/tensor/plain_view.rs:279-285).",
   "where": "nnef/src/tensors.rs:171-174 -> data/src/tensor.rs:282",
   "reason_to_dismiss": "The unchecked multiply is in tract-data's shared tensor allocator, used by every op and backend, and the new element-count check makes the allocation look already bounded.",
   "distance": "one package away (tract-nnef -> tract-data), 1 file",
   "present_in_latest": "unknown",
   "latest_where": ""
  }
 ],
 "O8b_injection_room": [
  {
   "where": "nnef/src/tensors.rs:274-287",
   "sibling": "A newly added block-quant format branch (the writer already emits 0x3081 at :315, which read_block_quant_value does not accept at :276-279) copying the same (q_m*q_k)/block_len*block_bytes computation.",
   "why_realistic": "The file already contains one such branch with its own shape arithmetic, and the reader/writer item-type sets already disagree, so a maintainer adding Q8_1 or a new GGML type would extend this match arm."
  },
  {
   "where": "nnef/src/resource.rs:86-104",
   "sibling": "Another ResourceLoader (a `.dat` variant, a compressed or legacy header format) that parses its own header and allocates a Tensor from its dims.",
   "why_realistic": "Nnef::default registers five loaders side by side (nnef/src/framework.rs:31-37), so a new loader is a natural place for the author to add format-specific parsing."
  },
  {
   "where": "onnx/src/tensor.rs:144-149",
   "sibling": "The same job in another package: create_tensor builds a Tensor from model-declared dims and raw bytes, where a shape/size overflow check could be omitted the same way.",
   "why_realistic": "Every format crate has its own proxy-tensor-to-Tensor conversion; a maintainer porting a checked-sizing fix would plausibly apply it there as well."
  }
 ],
 "O9_family": "CWE-190 integer overflow in a header-derived size computation, leading to CWE-125 out-of-bounds read on model load",
 "O9_dos": false,
 "O10_build": {
  "language": "Rust",
  "toolchain": "cargo, rustc >= 1.91 (workspace rust-version, Cargo.toml:121; edition 2024)",
  "services": [],
  "offline_after_build": true,
  "project_tests": "nnef/src/tensors.rs:321-385 (header_is_128_bytes; serde_tensor_complex_* round-trips, complex feature only); nnef/tests/parse.rs and nnef/tests/scatter_round_trip.rs exercise the text graph, not .dat header overflow; no overflow test for this path at the pinned commit."
 },
 "O11_fix_minutes": 45,
 "O12_red_flags": [],
 "O13_recall_risk": "low",
 "pattern_fit": "B",
 "j": {
  "j_multi_site": 1,
  "j_sites_touched": "nnef/src/tensors.rs",
  "j_sibling_sites": "yes",
  "j_cause_other_layer": 0,
  "j_defence_ineffective": 0,
  "j_overbroad_breaks_legit": 1,
  "j_tempting_wrong_fix": "Replace `shape.iter().product::<usize>()` at nnef/src/tensors.rs:64 with a checked_mul try_fold (the line the report names), add the two checked_mul comparisons, and stop there."
 },
 "out_of_scope_notes": [
  "nnef/src/tensors.rs:200-204 write_tensor casts tensor dims and byte length to u32 with `as` (truncating) and read_tensor never calls it; this is a save/reload corruption path, not an OOB read, so it is noted and not pursued.",
  "nnef/src/tensors.rs:69 `real_bit_size - 8` underflows when data_size_bytes < 1 for bool tensors (panic in debug builds); an adjacent panic-only issue, not the advisory's OOB read, noted and not pursued."
 ],
 "unverified": [
  "repo_mb not measured (no shell/du in this session); the pinned tree has roughly 1.8k files over 15 workspace crates, so tiny_repo is not plausible.",
  "Reachability of both O8 routes was reasoned statically, not constructed or run: the block-quant route needs data_size_bytes to equal the wrapped 36*len/32 residue (tunable over ~1.2e8 candidate dims) and the String route needs the wrapped 24*len to be small and non-zero; neither header was built or executed.",
  "Latest released code is 'none' per the input, so present_in_latest stays unknown for all O8 routes.",
  "The fix's third change compares `len.checked_mul(bits/8) != Some(data_size_bytes)`; for odd bits_per_item (e.g. 1-bit bool) integer division makes that comparison inexact, which the fix does not change - not examined further.",
  "Only the one-line advisory summary was available, so the scope read ('reject overflowing tensor dims on load') is inferred from the summary plus the fix."
 ]
}
  ```
- Published fix sites:   - nnef/src/tensors.rs:64-67 — entry point: tract_nnef::tensors::read_tensor (pub, nnef/src/lib.rs:13); also reached by DatLoader on model load (nnef/src/resource.rs:98) and by the CLI --input-from-nnef path (cli/src/params.rs:423,426) [public deserialization module (.dat tensor parser, nnef crate)]
  - nnef/src/tensors.rs:78 — entry point: tract_nnef::tensors::read_tensor, plain/quantized item-type branch [public deserialization module (.dat tensor parser, nnef crate)]
- Uncovered routes to confirm (pattern B):   - nnef/src/tensors.rs:284-287 — Block-quant `.dat` header (item_type 0x3080): read_block_quant_value recomputes expected_len = (q_m*q_k)/block_len*block_bytes with plain arithmetic; a shape whose element count fits usize but whose block-byte size wraps can still match the u32 data_size_bytes and yields a short Blob for a huge logical shape, with the identical unchecked expression at linalg/src/frame/block_quant/storage.rs:21 so the constructor's `ensure!` passes too. (reason to dismiss: Block-quant item types are an internal GGML-style tract extension (and the reader here already disagrees with the writer's 0x3081), so this branch can be argued never to have been in the advisory's scope.; still in latest: unknown)
  - nnef/src/tensors.rs:171-174 -> data/src/tensor.rs:282 — String `.dat` tensor: with bits_per_item = u32::MAX both size checks at :66-86 are skipped, and Tensor::zero_dt -> uninitialized_aligned_dt computes bytes = shape.product() * dt.size_of() with a plain `*` (data/src/tensor.rs:282); a smooth element count whose byte count wraps gives a short Blob for a huge shape, and as_slice_mut then builds a slice of `len` items over it (data/src/tensor/plain_view.rs:279-285). (reason to dismiss: The unchecked multiply is in tract-data's shared tensor allocator, used by every op and backend, and the new element-count check makes the allocation look already bounded.; still in latest: unknown)
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

## Environment (`tasks/tract-s5/environment/Dockerfile`)
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

## Report to the solver (`tasks/tract-s5/instruction.md`)
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

## Tests (`tasks/tract-s5/tests/`)
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
- **Wrong-fix patches** go in `build/tract-s5/checks/`, listed in `manifest.patch_checks`:
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
**`tasks/tract-s5/`:**
- `instruction.md`;
- `task.toml`, from `common/builder/templates/`, with `[metadata]` (incl. the delivery fields) filled in and
  `network_mode = "no-network"` (no allowlist);
- `environment/Dockerfile`;
- `solution/solve.sh` and `solution/fix.patch`;
- `tests/test.sh`, `tests/score.py`, `tests/security/` and `tests/functional/`.

**`build/tract-s5/manifest.json`:**
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

**Also in `build/tract-s5/`:**
- `checks/*.patch`;
- `notes.md`: start and end UTC, each lever in one line, what you verified, what you could not.

Pattern B: the register rows (see Design).

Use `common/builder/templates/` and `common/trial/smoke-task/` for the layout.

## Run the gate
Run the stages in order, one at a time:
```
python3 -I common/gate/gate.py tract-s5 --only static
python3 -I common/gate/gate.py tract-s5 --only nop
python3 -I common/gate/gate.py tract-s5 --only oracle
python3 -I common/gate/gate.py tract-s5 --only patches
```
In static, only the missing `blind` patch and the missing `FAIRNESS.md` may remain; others write
those after you. Do NOT write them yourself, and do NOT run trials or any target model.

## Machine and files
- **The machine:** one shared 8-CPU / 12 GB Docker VM that is running trials.
  - At most one Docker build or gate stage of yours at a time.
  - Never prune Docker images or the build cache.
  - Never stop containers you did not start.
- **Files:**
  - scratch work goes in `~/.tb-graders/cwe/work/tract-s5/`;
  - edit only `tasks/tract-s5/`, `build/tract-s5/` and, for pattern B, the register;
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
