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

Project root: `/home/mara/cwe-bench`. Task: `infracost-s4`. Pattern: `A+B`. Track: `injected`.

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
- Advisory: ["GHSA-6X6C-W9W9-HV4H", "CVE-2026-71494", "GO-2026-6437"]; infracost/infracost; CWE-522 insufficiently protected credentials: configured Terraform Cloud/registry token disclosed to an attacker-named host via unvalidated hostname input
- Pinned (vulnerable) commit: 565bcce88b2e61f48115bd48722b6606ac08abd6. Published fix: 3d24c757f5e4e60c7259f1b89ad7ceaabcfca86f.
- The screener's record (a lead to verify, not a fact):
  ```json
  {
 "screener_version": "screener-v2",
 "lessons_version": "lessons-v2",
 "model": "deepseek-flash[1m]",
 "entry_id": "16283",
 "advisory_ids": [
  "GHSA-6X6C-W9W9-HV4H",
  "CVE-2026-71494",
  "GO-2026-6437"
 ],
 "repo": "infracost/infracost",
 "pinned_commit": "565bcce88b2e61f48115bd48722b6606ac08abd6",
 "fix_commits": [
  "3d24c757f5e4e60c7259f1b89ad7ceaabcfca86f"
 ],
 "trust_decision": {
  "summary": "Whether the user's Terraform Cloud/Enterprise token (and the tfr:// registry token) may be sent to a host named by the scanned, untrusted Terraform input; decided by comparing that host against the configured trusted host in hostsEqual at each token-bearing sender.",
  "evidence": [
   "internal/hcl/remote_variables_loader.go:156-158",
   "internal/providers/terraform/dir_provider.go:425-437",
   "internal/providers/terraform/terragrunt_registry_service.go:259-264",
   "internal/providers/terraform/cloud.go:14-24",
   "internal/extclient/authed_client.go:52-59"
  ]
 },
 "landing_point": {
  "where": "internal/hcl/remote_variables_loader.go:156-158",
  "why": "The advisory's 'unvalidated hostname' is the `hostname` attribute of the scanned cloud/backend block; this is where that scanned value is written straight onto the token-bearing AuthedAPIClient (SetHost) before every authenticated Get, so an engineer reading only the summary starts here."
 },
 "fix_sites": [
  {
   "where": "internal/extclient/authed_client.go:46-49",
   "entry_point": "infracost breakdown --path <terraform dir> (HCL provider path)",
   "module_kind": "supporting library (host getter added so the caller can compare against the trusted host)"
  },
  {
   "where": "internal/hcl/parser.go:220-230",
   "entry_point": "infracost breakdown --path <terraform dir>",
   "module_kind": "hcl parser option (hostConfigured threaded through OptionWithTFCRemoteVarLoader)"
  },
  {
   "where": "internal/hcl/remote_variables_loader.go:156-158",
   "entry_point": "infracost breakdown --path <terraform dir> or --path <terragrunt dir>",
   "module_kind": "hcl remote variable loader (the cloud/backend hostname check)"
  },
  {
   "where": "internal/providers/terraform/cloud.go:14-38",
   "entry_point": "infracost breakdown --path <terraform dir> in terraform remote-execution mode",
   "module_kind": "helper (hostsEqual used against the remote-run URL host)"
  },
  {
   "where": "internal/providers/terraform/dir_provider.go:429-437",
   "entry_point": "infracost breakdown --path <terraform dir> with a remote-execution plan",
   "module_kind": "cli provider (tokenForRemoteHost validates the host parsed from terraform's remote-run URL)"
  },
  {
   "where": "internal/providers/terraform/hcl_provider.go:142-147",
   "entry_point": "infracost breakdown --path <terraform dir>",
   "module_kind": "provider wiring (passes hostConfigured into the loader)"
  },
  {
   "where": "internal/providers/terraform/terragrunt_hcl_provider.go:136-142",
   "entry_point": "infracost breakdown --path <terragrunt dir> (tfr:// module sources)",
   "module_kind": "provider wiring (swaps tgterraform.RegistryGetter for the local hardened getter)"
  },
  {
   "where": "internal/providers/terraform/terragrunt_registry_service.go:259-264",
   "entry_point": "infracost breakdown --path <terragrunt dir> with a tfr:// module source",
   "module_kind": "copied third-party getter (TG_TF_REGISTRY_TOKEN allowlist in httpGETAndGetResponse)"
  }
 ],
 "O1_entry_points": 3,
 "O2_out_of_scope_site": {
  "kind": "second_implementation",
  "where": "internal/providers/terraform/terragrunt_registry_service.go:66-68,259-264"
 },
 "O3_reason_to_dismiss": "The file is headed 'Contents of this file were copied from github.com/gruntwork-io/terragrunt' and its TerraformRegistryGetter is not referenced anywhere at the pinned commit (the live tfr:// getter is tgterraform.RegistryGetter at terragrunt_hcl_provider.go:137), so it reads as vendored dead code outside the Terraform Cloud token path, and the TG_TF_REGISTRY_TOKEN it guards is a different secret from TERRAFORM_CLOUD_TOKEN.",
 "O4_distance": {
  "files": 5,
  "packages": 3,
  "repo_mb": null
 },
 "O5_coupled_behaviour": {
  "what": "Terraform Enterprise/private-host users must keep working: a scanned cloud block that names the configured TERRAFORM_CLOUD_HOST (e.g. tfe.mycorp.com) must still load remote variables and still fetch private modules, and per-host tokens from ~/.terraformrc must still be usable; a fix that pins app.terraform.io or refuses every non-default host breaks those legitimate cases.",
  "where": "internal/hcl/remote_variables_loader.go:156-158; internal/hcl/modules/credentials_source.go:75-82; internal/providers/terraform/terragrunt_registry_service.go:103-113"
 },
 "O6_input_shapes": [
  "cloud block `hostname` attribute (getCloudOrganizationWorkspace)",
  "backend \"remote\" `hostname` attribute (getBackendOrganizationWorkspace)",
  "host in the remote-run URL printed by terraform on stdout (scheme+host+path, run id from the path)",
  "tfr:// module source registry domain, including the empty-host default (defaultRegistryDomain / defaultRegistryHost())",
  "absolute or relative X-Terraform-Get header URL",
  "host with different case or a trailing dot (hostsEqual uses EqualFold + TrimSuffix)",
  "two policy shapes: host configured (warn and skip / error) vs host not configured (error)"
 ],
 "O7_producer": {
  "kind": "handler",
  "where": "internal/hcl/remote_variables_loader.go:273-289",
  "check_calls_producer": true
 },
 "O8_uncovered_routes": [
  {
   "route": "Plain (non-terragrunt) registry module download attaches the resolved registry credentials to a URL taken from the registry's service-discovery `modules.v1` value, so the bearer token can go to a host other than the one the credential was issued for.",
   "where": "internal/hcl/modules/registry.go:124-162",
   "reason_to_dismiss": "The registry host in question is the module source host the user chose, and its .well-known/terraform.json is part of the trusted registry protocol that Terraform itself follows, so the redirect target is arguably the trusted host's own decision and not 'unvalidated hostname' input.",
   "distance": "different package from the landing point (internal/hcl/modules vs internal/hcl) and a different credential carrier (CredentialsSource/Disco rather than AuthedAPIClient); this file is not touched by the fix",
   "present_in_latest": "unknown",
   "latest_where": ""
  }
 ],
 "O8b_injection_room": [
  {
   "where": "internal/providers/terraform/cloud.go:14-24",
   "sibling": "a single low-level 'send bearer token' helper that all Terraform Cloud API calls go through",
   "why_realistic": "The fix already adds hostsEqual to this file, so a maintainer consolidating the rule would plausibly move the host check into cloudAPI itself; a sibling helper that sends the same token to a caller-supplied host is exactly this shape."
  },
  {
   "where": "internal/hcl/modules/credentials_source.go:75-82",
   "sibling": "a second credential provider whose ForHost falls back to the configured token when the requested host is unknown",
   "why_realistic": "Terraform's own credential system has both a base credential set and a per-host lookup; adding a 'default to base token' fallback here is a natural-looking simplification that would send the token to an arbitrary module-source host."
  },
  {
   "where": "internal/providers/terraform/terragrunt_hcl_provider.go:136-142",
   "sibling": "a second getter registration (e.g. an https/file or dependency-fetch getter) that also attaches TG_TF_REGISTRY_TOKEN",
   "why_realistic": "Getters are registered in a map literal here, so adding a sibling getter for another source scheme, with the env-var token attached, is a one-line change a maintainer could make."
  }
 ],
 "O9_family": "CWE-522 insufficiently protected credentials: configured Terraform Cloud/registry token disclosed to an attacker-named host via unvalidated hostname input",
 "O9_dos": false,
 "O10_build": {
  "language": "Go",
  "toolchain": "Go 1.25.11 (go.mod:3); go build ./... and go test ./...; modules resolved from go.sum at build time (go mod download), so the first build needs a module proxy or cache",
  "services": [],
  "offline_after_build": true,
  "project_tests": "internal/hcl/*_test.go (parser, blocks, module loading against testdata dirs) and internal/providers/terraform/*_test.go cover the HCL providers and the TFC remote-variable loader; the fix adds internal/hcl/remote_variables_loader_tfc_test.go and internal/providers/terraform/cloud_security_test.go, neither of which exists at the pinned commit. Both new tests build blocks from a local temp dir and never need the network (mismatch paths return before any HTTP call)."
 },
 "O11_fix_minutes": 45,
 "O12_red_flags": [],
 "O13_recall_risk": "low",
 "pattern_fit": "A+B",
 "j": {
  "j_multi_site": 1,
  "j_sites_touched": "internal/extclient/authed_client.go, internal/hcl/parser.go, internal/hcl/remote_variables_loader.go, internal/providers/terraform/cloud.go, internal/providers/terraform/dir_provider.go, internal/providers/terraform/hcl_provider.go, internal/providers/terraform/terragrunt_hcl_provider.go, internal/providers/terraform/terragrunt_registry_service.go",
  "j_sibling_sites": "yes",
  "j_cause_other_layer": 1,
  "j_defence_ineffective": 0,
  "j_overbroad_breaks_legit": 1,
  "j_tempting_wrong_fix": "Add a single check in remote_variables_loader.Load that compares config.Host against app.terraform.io (hardcoded), which blocks the report's example but breaks Terraform Enterprise users and never touches the remote-run URL host or the tfr:// registry token."
 },
 "out_of_scope_notes": [
  "internal/apiclient/client.go:131 also sends a Bearer token, but it is the Infracost API key to the Infracost API, unrelated to this advisory and not pursued.",
  "The live tfr:// getter at the pinned commit lives in the replaced dependency github.com/infracost/terragrunt (go.mod:317), which is outside this tree; only the local copied getter was read."
 ],
 "unverified": [
  "Repository size in MB: no shell available, so it was not measured; the tree has 1180+ Go files, so tiny_repo (<5 MB source) and giant_repo (>1.5 GB) both look wrong, but repo_mb is left null.",
  "Whether the O8 route (service-discovery download URL) is still present in the latest release: no network and no latest checkout, so present_in_latest is unknown.",
  "Whether the plan-cache save/reload path (internal/providers/terraform/plan_cache.go:33-34,246-247 serialises TerraformCloudToken/TerraformCloudHost) can feed a DirProvider whose tokenForRemoteHost check is bypassed: the cached host/token are part of the cache key at plan_cache.go:68-76, which suggests not, but this was not exercised.",
  "End-to-end behaviour of the positive path (matching trusted host) could not be run; it needs a Terraform Cloud/Enterprise endpoint or a local httptest server."
 ]
}
  ```
- Published fix sites:   - internal/extclient/authed_client.go:46-49 — entry point: infracost breakdown --path <terraform dir> (HCL provider path) [supporting library (host getter added so the caller can compare against the trusted host)]
  - internal/hcl/parser.go:220-230 — entry point: infracost breakdown --path <terraform dir> [hcl parser option (hostConfigured threaded through OptionWithTFCRemoteVarLoader)]
  - internal/hcl/remote_variables_loader.go:156-158 — entry point: infracost breakdown --path <terraform dir> or --path <terragrunt dir> [hcl remote variable loader (the cloud/backend hostname check)]
  - internal/providers/terraform/cloud.go:14-38 — entry point: infracost breakdown --path <terraform dir> in terraform remote-execution mode [helper (hostsEqual used against the remote-run URL host)]
  - internal/providers/terraform/dir_provider.go:429-437 — entry point: infracost breakdown --path <terraform dir> with a remote-execution plan [cli provider (tokenForRemoteHost validates the host parsed from terraform's remote-run URL)]
  - internal/providers/terraform/hcl_provider.go:142-147 — entry point: infracost breakdown --path <terraform dir> [provider wiring (passes hostConfigured into the loader)]
  - internal/providers/terraform/terragrunt_hcl_provider.go:136-142 — entry point: infracost breakdown --path <terragrunt dir> (tfr:// module sources) [provider wiring (swaps tgterraform.RegistryGetter for the local hardened getter)]
  - internal/providers/terraform/terragrunt_registry_service.go:259-264 — entry point: infracost breakdown --path <terragrunt dir> with a tfr:// module source [copied third-party getter (TG_TF_REGISTRY_TOKEN allowlist in httpGETAndGetResponse)]
- Uncovered routes to confirm (pattern B):   - internal/hcl/modules/registry.go:124-162 — Plain (non-terragrunt) registry module download attaches the resolved registry credentials to a URL taken from the registry's service-discovery `modules.v1` value, so the bearer token can go to a host other than the one the credential was issued for. (reason to dismiss: The registry host in question is the module source host the user chose, and its .well-known/terraform.json is part of the trusted registry protocol that Terraform itself follows, so the redirect target is arguably the trusted host's own decision and not 'unvalidated hostname' input.; still in latest: unknown)
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

## Environment (`tasks/infracost-s4/environment/Dockerfile`)
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

## Report to the solver (`tasks/infracost-s4/instruction.md`)
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

## Tests (`tasks/infracost-s4/tests/`)
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
- **Wrong-fix patches** go in `build/infracost-s4/checks/`, listed in `manifest.patch_checks`:
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
**`tasks/infracost-s4/`:**
- `instruction.md`;
- `task.toml`, from `common/builder/templates/`, with `[metadata]` (incl. the delivery fields) filled in and
  `network_mode = "no-network"` (no allowlist);
- `environment/Dockerfile`;
- `solution/solve.sh` and `solution/fix.patch`;
- `tests/test.sh`, `tests/score.py`, `tests/security/` and `tests/functional/`.

**`build/infracost-s4/manifest.json`:**
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

**Also in `build/infracost-s4/`:**
- `checks/*.patch`;
- `notes.md`: start and end UTC, each lever in one line, what you verified, what you could not.

Pattern B: the register rows (see Design).

Use `common/builder/templates/` and `common/trial/smoke-task/` for the layout.

## Run the gate
Run the stages in order, one at a time:
```
python3 -I common/gate/gate.py infracost-s4 --only static
python3 -I common/gate/gate.py infracost-s4 --only nop
python3 -I common/gate/gate.py infracost-s4 --only oracle
python3 -I common/gate/gate.py infracost-s4 --only patches
```
In static, only the missing `blind` patch and the missing `FAIRNESS.md` may remain; others write
those after you. Do NOT write them yourself, and do NOT run trials or any target model.

## Machine and files
- **The machine:** one shared 8-CPU / 12 GB Docker VM that is running trials.
  - At most one Docker build or gate stage of yours at a time.
  - Never prune Docker images or the build cache.
  - Never stop containers you did not start.
- **Files:**
  - scratch work goes in `~/.tb-graders/cwe/work/infracost-s4/`;
  - edit only `tasks/infracost-s4/`, `build/infracost-s4/` and, for pattern B, the register;
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
