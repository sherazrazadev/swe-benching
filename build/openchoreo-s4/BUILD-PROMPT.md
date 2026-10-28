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

Project root: `/home/mara/cwe-bench`. Task: `openchoreo-s4`. Pattern: `A+B`. Track: `injected`.

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
- Advisory: ["GHSA-C5F6-2RM9-2W8G", "CVE-2026-73840", "GO-2026-6360"]; openchoreo/openchoreo; authentication bypass via webhook signature verification that fails open (CWE-287 improper authentication, CWE-290 authorization bypass by spoofing, CWE-345 insufficient verification of data authenticity)
- Pinned (vulnerable) commit: 8b1835244baeac6f0d20789b3ebb7108d0e2fee0. Published fix: 268efd9b762a3f4f72b55d9c1b13dfc55122127b, 8af4a3fc8725fc2d8a9de9611e77278a5c48f978, f540553db7143141b73bb37fae02102e6f082a34.
- The screener's record (a lead to verify, not a fact):
  ```json
  {
 "screener_version": "screener-v2",
 "lessons_version": "lessons-v2",
 "model": "deepseek-flash[1m]",
 "entry_id": "17071",
 "advisory_ids": [
  "GHSA-C5F6-2RM9-2W8G",
  "CVE-2026-73840",
  "GO-2026-6360"
 ],
 "repo": "openchoreo/openchoreo",
 "pinned_commit": "8b1835244baeac6f0d20789b3ebb7108d0e2fee0",
 "fix_commits": [
  "268efd9b762a3f4f72b55d9c1b13dfc55122127b",
  "8af4a3fc8725fc2d8a9de9611e77278a5c48f978",
  "f540553db7143141b73bb37fae02102e6f082a34"
 ],
 "trust_decision": {
  "summary": "Whether an inbound webhook may trigger workflow runs is decided in two layers: autobuildService.ProcessWebhook validates the payload against the per-provider key in the openchoreo-control-plane/git-webhook-secrets Secret (HMAC/token validation is the ONLY authentication on POST /api/v1alpha1/autobuild, which is declared security: []), and webhookProcessor.findAffectedComponents decides which components that authenticated event is allowed to build.",
  "evidence": [
   "openapi/openchoreo-api.yaml:3719",
   "internal/openchoreo-api/services/autobuild/webhook_processor.go:23-28",
   "internal/openchoreo-api/services/autobuild/service.go:56-66",
   "internal/openchoreo-api/services/autobuild/webhook_processor.go:88-104",
   "internal/openchoreo-api/services/autobuild/webhook_processor.go:139-160"
  ]
 },
 "landing_point": {
  "where": "internal/openchoreo-api/services/git/bitbucket.go:26",
  "why": "The summary 'unauthenticated build/workflow trigger via git-provider confusion (webhook signature bypass)' leads straight to the Bitbucket provider, where an empty token is explicitly accepted (`if token == \"\" { return nil }`) under a TODO saying HMAC validation is not implemented, and the handler never passes a signature for Bitbucket (webhook_handler.go:58-59)."
 },
 "fix_sites": [
  {
   "where": "internal/openchoreo-api/services/git/bitbucket.go:23-34",
   "entry_point": "POST /api/v1alpha1/autobuild, X-Event-Key branch",
   "module_kind": "provider_implementation"
  },
  {
   "where": "internal/openchoreo-api/services/git/github.go:25-45",
   "entry_point": "POST /api/v1alpha1/autobuild, X-Hub-Signature-256 branch",
   "module_kind": "provider_implementation (deduplicated into shared helper; gains fail-closed empty-secret)"
  },
  {
   "where": "fix.diff:1679-1716 (new file internal/openchoreo-api/services/git/signature.go)",
   "entry_point": "called by both provider implementations",
   "module_kind": "shared_low_level_helper"
  },
  {
   "where": "internal/openchoreo-api/api/handlers/webhook_handler.go:58-59",
   "entry_point": "POST /api/v1alpha1/autobuild",
   "module_kind": "http_handler / header-composition wrapper"
  },
  {
   "where": "internal/openchoreo-api/services/autobuild/service.go:56-57",
   "entry_point": "POST /api/v1alpha1/autobuild -> AutoBuildService.ProcessWebhook",
   "module_kind": "service (secret-retrieval policy)"
  },
  {
   "where": "internal/openchoreo-api/services/autobuild/service.go:83-111",
   "entry_point": "POST /api/v1alpha1/autobuild -> AutoBuildService.getWebhookSecret",
   "module_kind": "service (allowEmpty fail-open removed)"
  },
  {
   "where": "fix.diff:1362-1398 (inserted at internal/openchoreo-api/services/autobuild/webhook_processor.go:147)",
   "entry_point": "POST /api/v1alpha1/autobuild -> webhookProcessor.findAffectedComponents",
   "module_kind": "domain_logic (authenticated provider vs component repository host)"
  },
  {
   "where": "openapi/openchoreo-api.yaml:3720-3738",
   "entry_point": "POST /api/v1alpha1/autobuild contract",
   "module_kind": "api_spec"
  },
  {
   "where": "internal/openchoreo-api/api/gen/models.gen.go:5385-5395",
   "entry_point": "POST /api/v1alpha1/autobuild (generated params struct)",
   "module_kind": "generated_api"
  },
  {
   "where": "internal/openchoreo-api/api/gen/server.gen.go:8578-8632",
   "entry_point": "POST /api/v1alpha1/autobuild (generated header binder)",
   "module_kind": "generated_api"
  },
  {
   "where": "internal/openchoreo-api/api/gen/client.gen.go:14845-14880",
   "entry_point": "generated client for the same route",
   "module_kind": "generated_api"
  }
 ],
 "O1_entry_points": 1,
 "O2_out_of_scope_site": {
  "kind": "wrapper_or_composition",
  "where": "internal/openchoreo-api/api/handlers/webhook_handler.go:58-59"
 },
 "O3_reason_to_dismiss": "Bitbucket never sent a signature header, and the header-detection helper plus the OpenAPI/generated-param layer are 'just plumbing' - the reported bypass lives inside BitbucketProvider.ValidateWebhookPayload, so the composition layer can be left untouched.",
 "O4_distance": {
  "files": 10,
  "packages": 4,
  "repo_mb": null
 },
 "O5_coupled_behaviour": {
  "what": "Genuine Bitbucket deliveries (which do carry X-Hub-Signature) must still be accepted, and components whose repository lives on a self-hosted GitLab/GitHub Enterprise host - where the provider cannot be inferred from the host - must still have builds triggered. A fail-closed-only fix rejects every real Bitbucket webhook; an over-strict repository check stops self-hosted installs from ever building.",
  "where": "internal/openchoreo-api/services/autobuild/webhook_processor.go:340-351 (self-hosted hosts deliberately supported) and fix.diff:1396-1397 (unknown host -> no provider check)"
 },
 "O6_input_shapes": [
  "Bitbucket signature as 'sha256=<hex>' HMAC-SHA256 over the raw body, sent in the new X-Hub-Signature header (fix.diff:1696-1716)",
  "missing or empty signature -> reject instead of skip (fix.diff:1701-1702)",
  "malformed signature / no 'sha256=' prefix -> reject (fix.diff:1703-1704)",
  "missing or empty secret -> reject fail-closed, replacing the allowEmpty path (fix.diff:1697-1698 and 1045-1079)",
  "GitLab keeps verbatim token comparison (internal/openchoreo-api/services/git/gitlab.go:22-32, unchanged)",
  "repository URL shapes: https with .git, git@host:path, ssh://, git+ssh://, trailing slash, uppercase (internal/openchoreo-api/services/autobuild/webhook_processor.go:343-362)",
  "org/name path that contains another provider's domain, e.g. https://bitbucket.org/my-org/github.com-sync (fix.diff:1384-1388)",
  "host that is not a known SaaS provider -> provider check skipped (fix.diff:1396-1397)"
 ],
 "O7_producer": {
  "kind": "mapper",
  "where": "internal/openchoreo-api/services/autobuild/webhook_processor.go:180-241 (extractRepoInfoFromComponent: repository identity is mapped out of the Workflow/ClusterWorkflow openAPIV3Schema extensions plus the component parameters, with a schema-default fallback for branch)",
  "check_calls_producer": true
 },
 "O8_uncovered_routes": [
  {
   "route": "A component whose repository URL does not parse to a host (schemeless like 'github.com/org/repo', or the slash form 'git@github.com/org/repo') still matches an attacker-forged webhook URL through matchesRepository's normalized string equality, but providerFromRepoURL returns \"\" for it, so the provider-consistency check is skipped and the build is triggered for a repository hosted on another provider.",
   "where": "internal/openchoreo-api/services/autobuild/webhook_processor.go:139-146",
   "reason_to_dismiss": "Self-hosted GitLab/GitHub Enterprise and hand-written repository parameters are legitimate, and the provider cannot be inferred from an unknown host, so skipping the check is the documented, intended behaviour (fix.diff:1359-1362).",
   "distance": "same function as the repository match, one package away from the provider implementations; the two normalizers are in different packages (git and autobuild)",
   "present_in_latest": "unknown",
   "latest_where": ""
  }
 ],
 "O8b_injection_room": [
  {
   "where": "internal/openchoreo-api/services/autobuild/webhook_processor.go:42-48",
   "sibling": "a second caller of webhookProcessor.ProcessWebhook, e.g. a webhook redeliver/backfill CLI or admin endpoint",
   "why_realistic": "The processor and its interface (service.go:26-28) are exported and take only provider+payload, so a maintainer adding a replay or migration tool would call it directly and bypass autobuildService.ProcessWebhook and therefore every signature check."
  },
  {
   "where": "internal/openchoreo-api/services/git/provider.go:39-49",
   "sibling": "a fourth provider (Gitea, Bitbucket Server/Data Center, Azure DevOps) added to GetProvider",
   "why_realistic": "This switch is the project's documented extension point, and Bitbucket Server reuses X-Hub-Signature, so a maintainer would add it and could easily write ValidateWebhookPayload without wiring verifyHMACSHA256 - exactly the second-implementation shape this fix had to repair."
  },
  {
   "where": "internal/openchoreo-api/services/autobuild/interface.go:12-17",
   "sibling": "a portal 'test / simulate webhook' endpoint that calls AutoBuildService.ProcessWebhook with caller-supplied Signature and SignatureHeader",
   "why_realistic": "ProcessWebhookParams lets any caller choose the signature header, signature and secret key, so a UI feature would pass empty values and reach the workflow-trigger sink without any signature."
  }
 ],
 "O9_family": "authentication bypass via webhook signature verification that fails open (CWE-287 improper authentication, CWE-290 authorization bypass by spoofing, CWE-345 insufficient verification of data authenticity)",
 "O9_dos": false,
 "O10_build": {
  "language": "Go (go.mod:3 declares go 1.26.3; also Python agents and Helm charts in the same repo)",
  "toolchain": "go build / go test; make go.test (make/golang.mk:170) runs manifests, generate, fmt, vet, envtest and then `go test $(go list ./... | grep -v /e2e)`; make openapi-codegen (make/golang.mk:186) regenerates internal/openchoreo-api/api/gen from openapi/openchoreo-api.yaml",
  "services": [],
  "offline_after_build": true,
  "project_tests": "internal/openchoreo-api/services/git (provider unit tests; bitbucket_test.go and signature.go are added by the fix), internal/openchoreo-api/services/autobuild (service_test.go and webhook_processor_test.go using the controller-runtime fake client via services/testutil/testutil.go:33), internal/openchoreo-api/api/handlers/webhook_handler_test.go; no cluster or network needed for these packages"
 },
 "O11_fix_minutes": 90,
 "O12_red_flags": [],
 "O13_recall_risk": "low",
 "pattern_fit": "A+B",
 "j": {
  "j_multi_site": 1,
  "j_sites_touched": "internal/openchoreo-api/services/git/bitbucket.go, internal/openchoreo-api/services/git/github.go, internal/openchoreo-api/services/git/signature.go, internal/openchoreo-api/api/handlers/webhook_handler.go, internal/openchoreo-api/services/autobuild/service.go, internal/openchoreo-api/services/autobuild/webhook_processor.go, openapi/openchoreo-api.yaml, internal/openchoreo-api/api/gen/models.gen.go, internal/openchoreo-api/api/gen/server.gen.go, internal/openchoreo-api/api/gen/client.gen.go",
  "j_sibling_sites": "yes",
  "j_cause_other_layer": 1,
  "j_defence_ineffective": 1,
  "j_overbroad_breaks_legit": 1,
  "j_tempting_wrong_fix": "Delete the empty-token skip in BitbucketProvider.ValidateWebhookPayload (or make it reject anything that is not the secret) without plumbing X-Hub-Signature through detectGitProviderFromParams and the OpenAPI/generated params - the forgery is blocked, but every genuine Bitbucket webhook is now rejected because the handler still supplies an empty signature."
 },
 "out_of_scope_notes": [
  "GitLab tokens are compared with plain != rather than constant time (internal/openchoreo-api/services/git/gitlab.go:27); that timing side channel is outside this advisory's protection and was not pursued.",
  "The fix diff embeds a ~12k-line regenerated swaggerSpec blob in server.gen.go (fix.diff:71-952); it is mechanical and was not analysed line by line."
 ],
 "unverified": [
  "Repository size in MB: no shell available to measure; the tree has 2600+ files (Go services, Python agents, Helm charts), clearly not tiny, but the tiny_repo/giant_repo thresholds could not be checked.",
  "Whether the latest release contains the fix: the task states the latest release is 'none', so present_in_latest is unknown.",
  "Whether Bitbucket Cloud actually emits X-Hub-Signature with 'sha256=<hex>' - taken from the fix's own comments (fix.diff:1522-1525); no external documentation was consulted.",
  "Whether `make openapi-codegen` can run offline (it installs oapi-codegen from the tools target); only the targeted `go test` packages are known to work offline."
 ]
}
  ```
- Published fix sites:   - internal/openchoreo-api/services/git/bitbucket.go:23-34 — entry point: POST /api/v1alpha1/autobuild, X-Event-Key branch [provider_implementation]
  - internal/openchoreo-api/services/git/github.go:25-45 — entry point: POST /api/v1alpha1/autobuild, X-Hub-Signature-256 branch [provider_implementation (deduplicated into shared helper; gains fail-closed empty-secret)]
  - fix.diff:1679-1716 (new file internal/openchoreo-api/services/git/signature.go) — entry point: called by both provider implementations [shared_low_level_helper]
  - internal/openchoreo-api/api/handlers/webhook_handler.go:58-59 — entry point: POST /api/v1alpha1/autobuild [http_handler / header-composition wrapper]
  - internal/openchoreo-api/services/autobuild/service.go:56-57 — entry point: POST /api/v1alpha1/autobuild -> AutoBuildService.ProcessWebhook [service (secret-retrieval policy)]
  - internal/openchoreo-api/services/autobuild/service.go:83-111 — entry point: POST /api/v1alpha1/autobuild -> AutoBuildService.getWebhookSecret [service (allowEmpty fail-open removed)]
  - fix.diff:1362-1398 (inserted at internal/openchoreo-api/services/autobuild/webhook_processor.go:147) — entry point: POST /api/v1alpha1/autobuild -> webhookProcessor.findAffectedComponents [domain_logic (authenticated provider vs component repository host)]
  - openapi/openchoreo-api.yaml:3720-3738 — entry point: POST /api/v1alpha1/autobuild contract [api_spec]
  - internal/openchoreo-api/api/gen/models.gen.go:5385-5395 — entry point: POST /api/v1alpha1/autobuild (generated params struct) [generated_api]
  - internal/openchoreo-api/api/gen/server.gen.go:8578-8632 — entry point: POST /api/v1alpha1/autobuild (generated header binder) [generated_api]
  - internal/openchoreo-api/api/gen/client.gen.go:14845-14880 — entry point: generated client for the same route [generated_api]
- Uncovered routes to confirm (pattern B):   - internal/openchoreo-api/services/autobuild/webhook_processor.go:139-146 — A component whose repository URL does not parse to a host (schemeless like 'github.com/org/repo', or the slash form 'git@github.com/org/repo') still matches an attacker-forged webhook URL through matchesRepository's normalized string equality, but providerFromRepoURL returns "" for it, so the provider-consistency check is skipped and the build is triggered for a repository hosted on another provider. (reason to dismiss: Self-hosted GitLab/GitHub Enterprise and hand-written repository parameters are legitimate, and the provider cannot be inferred from an unknown host, so skipping the check is the documented, intended behaviour (fix.diff:1359-1362).; still in latest: unknown)
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

## Environment (`tasks/openchoreo-s4/environment/Dockerfile`)
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

## Report to the solver (`tasks/openchoreo-s4/instruction.md`)
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

## Tests (`tasks/openchoreo-s4/tests/`)
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
- **Wrong-fix patches** go in `build/openchoreo-s4/checks/`, listed in `manifest.patch_checks`:
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
**`tasks/openchoreo-s4/`:**
- `instruction.md`;
- `task.toml`, from `common/builder/templates/`, with `[metadata]` (incl. the delivery fields) filled in and
  `network_mode = "no-network"` (no allowlist);
- `environment/Dockerfile`;
- `solution/solve.sh` and `solution/fix.patch`;
- `tests/test.sh`, `tests/score.py`, `tests/security/` and `tests/functional/`.

**`build/openchoreo-s4/manifest.json`:**
- `slug`, `candidate`;
- `pattern`: `A+B`;
- `builder_prompt_version`: `build-v1`;
- `"strict_gate": true`;
- `verified`: entry point, sites, routes, services, project tests run;
- `leak_terms`, `patch_checks`, `wrong_fix_catalogue`;
- `traps`: one entry per lever, with `shape`, `where` (file:line), `security_tests`,
  `coupled_functional_tests`, `security_fail_patch`, and `realistic_because` (for pattern B: "real,
  unmodified upstream code");
- `status`.

**Also in `build/openchoreo-s4/`:**
- `checks/*.patch`;
- `notes.md`: start and end UTC, each lever in one line, what you verified, what you could not.

Pattern B: the register rows (see Design).

Use `common/builder/templates/` and `common/trial/smoke-task/` for the layout.

## Run the gate
Run the stages in order, one at a time:
```
python3 -I common/gate/gate.py openchoreo-s4 --only static
python3 -I common/gate/gate.py openchoreo-s4 --only nop
python3 -I common/gate/gate.py openchoreo-s4 --only oracle
python3 -I common/gate/gate.py openchoreo-s4 --only patches
```
In static, only the missing `blind` patch and the missing `FAIRNESS.md` may remain; others write
those after you. Do NOT write them yourself, and do NOT run trials or any target model.

## Machine and files
- **The machine:** one shared 8-CPU / 12 GB Docker VM that is running trials.
  - At most one Docker build or gate stage of yours at a time.
  - Never prune Docker images or the build cache.
  - Never stop containers you did not start.
- **Files:**
  - scratch work goes in `~/.tb-graders/cwe/work/openchoreo-s4/`;
  - edit only `tasks/openchoreo-s4/`, `build/openchoreo-s4/` and, for pattern B, the register;
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
