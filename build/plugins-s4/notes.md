# plugins-s4 — build notes

Start (UTC): 2026-10-29T00:57:03Z
End (UTC): 2026-10-29T01:17:01Z

## Task in one line

Advisory GHSA-JHJP-4C2Q-XMX4 / GO-2026-6538, falcosecurity/plugins, CWE-693: the shipped
Kubernetes-audit detection reports a privileged pod only from `spec.containers`, so a privilege
setting carried by an init or ephemeral container is never reported. Pinned
14de2cb5e1c8ec0b2718f89e3dd821fd33c2f4e2; published fix 0adb9b3c7e2c8bad53f30d01c057e038b2afa5e1.

## The one property (stated once, general)

"The shipped Kubernetes-audit detection must never miss a per-container security setting that a
request sets: for every setting the rule set reports, a value carried by any container the request
would run is seen and reported, whichever container list declares it and however the request
delivers it. The existing trusted-image allowance stays the only exception."

Covers every route/sibling without naming any of them. The instruction's concrete trigger is one
privileged init container on pod create.

## Levers

- **L1 (main, how-type) — route where the protection never existed, with a payload-shape trap.**
  Ephemeral containers are added through the `pods/ephemeralcontainers` subresource; the audit
  request object is a top-level `EphemeralContainers` object (`requestObject.ephemeralContainers`),
  not `requestObject.spec.ephemeralContainers`. The published fix's new ephemeral fields read the
  spec path, and the pod-create rule requires `pod` (no subresource) + `create`, so this route is
  unreported at the pinned commit and the published fix does not close it. Why a solver skips it:
  "ephemeral containers are a separate feature with their own EphemeralContainers Created rule."
  Fix needs the payload mechanism, not just a list name.
- **L2 (how-type, coupled must-keep-working) — per-list scoping and the trusted-image exception.**
  The tempting fix unions all three lists into `ka.req.pod.containers.*`. That breaks the
  index alignment of `containers.*` with `containers.image.repository`, changes the deprecated
  `ka.req.container.image`/`.image.repository`/`.privileged` meanings, and makes the trusted-image
  exception fire on trusted DaemonSets. Why a solver does it: "one more term in the same field is
  the smallest fix."
- **L3 (injected sibling, where-type) — a second shipped detection with the same list-scope gap.**
  `Create Pod With Added Capabilities` (CIS 5.2.3) checks `containers.add_capabilities` only.
  Why a solver skips it: "the report is about privileged, not capabilities."
- **L4 (injected sibling, where-type) — a third shipped detection with the same gap.**
  `Create Pod With Privilege Escalation` (CIS 5.2.5) checks
  `containers.allow_privilege_escalation` only. Why a solver skips it: "a different setting, and
  it is not the rule the report names."

L1 is the main how-type lever; L2 is a second how-type lever with a different failure mode
(over-broad change). L3/L4 are extras with different dismissal reasons (different setting, not the
reported rule).

## Candidate list (every sibling site/route found), and why the picks won

Landing point: `plugins/k8saudit/rules/k8s_audit_rules.yaml:243` (Create Privileged Pod).

Pattern A candidates (published-fix sites / entry points):
1. `plugins/k8saudit/pkg/k8saudit/fields.go:26` `Fields()` registry — the engine-facing producer
   of field names. Required by any rule that names a new field. Kept as a required site
   (field-surface security tests), not a separate lever: a solver who follows the rule to the
   extractor finds it.
2. `plugins/k8saudit/pkg/k8saudit/extract.go:118` `ExtractFromJSON` — the shared extractor for the
   base plugin and all four cloud wrappers (they embed `k8saudit.Plugin`). Kept as a site.
3. Four cloud wrappers (`k8saudit-aks/eks/gke/ovh`) — they embed the base plugin and inherit
   `Fields()`/`ExtractFromJSON`; they are not separate implementations upstream, and their modules
   pin the base plugin by released version, so a wrapper-override lever would be artificial and
   would not be reachable without changing the wrapper's module graph. Not built.
4. Deprecated scalar aliases `ka.req.container.image`, `.image.repository`, `.privileged`
   (`extract.go` ~259-300) — real lower-level API, but the published fix deliberately keeps them
   regular-container-only. Kept as a coupled functional contract, not a lever.
5. `k8saudit-gke` rules overlay (trusted images) and `hack/rules.yaml` — image policy / debug
   material; the overlay is additive and the base privileged rule still runs, so no detection gap.
   Not built.
6. README field tables in base and wrappers — documentation; not reachable.

Pattern B candidates (routes where coverage is missing at the pinned commit, unmodified upstream):
1. Privileged ephemeral container added through `pods/ephemeralcontainers` (update/patch) —
   real, confirmed by reading the shipped macros and the top-level payload path used by the
   existing EphemeralContainers Created rule. **Built as L1.** Strongest: the shape differs from
   the field the published fix adds, and the rule cannot match the route.
2. Deprecated `ka.req.container.privileged` keeps regular-container scope — real, but no shipped
   rule consumes it; the property is about shipped detection. Kept as functional contract only.
3. Trusted-image exception inspects only regular container images — real, but deliberate product
   policy; treated as coupled must-keep-working, not a reportable route.
4. `Create Disallowed Pod` / `Pod Created in Kube Namespace` image rules read only
   `spec.containers` — image policy, not the privileged/per-container setting property. Not built.
5. `EphemeralContainers Created` output path `requestObject/ephemeralContainers/0` — this is in
   fact the correct path for the subresource payload; it is the extractor's spec path that is
   wrong. Folded into L1, not a separate route.

Injected siblings (gaps added where the published fix never touches):
- IS1 `Create Pod With Added Capabilities` — placed after the HostIPC rule (~line 315). Chosen
  over an overlay rule because it is a genuine shipped detection, valid at pinned (its field
  exists), and costs a search of the whole rule set.
- IS2 `Create Pod With Privilege Escalation` — placed after `Pod Created in Kube Namespace`
  (~line 480). Chosen for distance from the landing point and a different dismissal reason.
- Rejected: a workload-template rule (controllers still create audited pods, so not a real
  bypass); a GKE overlay rule (base rule still fires; not a gap); a wrapper override (module graph
  pins the released base, artificial); a fourth setting rule (more instances of one concept).

## Sites / routes / shapes the security tests cover

- Pod create, privileged init container (reported trigger).
- Pod create, privileged init container with all 14 per-container settings set (shape + index arg).
- Subresource `pods/ephemeralcontainers` update, privileged ephemeral container (L1), including the
  top-level payload shape and the field returned for that shape.
- Field catalogue completeness for init and ephemeral lists, derived from the existing regular
  list (no hard-coded field list), and no `host_port` for ephemeral (carries no ports).
- Injected rule L3: init container add_capabilities SYS_ADMIN.
- Injected rule L4: init container allowPrivilegeEscalation true.
- Absent securityContext/subfield, index argument vs whole list, array-per-container join.

Detection is asserted differentially: the set of shipped rules that fire for the malicious event
minus the set that fires for its benign twin must be non-empty. This accepts a correct fix at any
layer (new rule, macro, or direct json path) and rejects an always-firing rule.

## Coupled must-keep-working behaviour (functional tests)

- Trusted regular image still suppresses the privileged detection (L2).
- `ka.req.pod.containers.*` stays scoped to regular containers and index-aligned (L2).
- Deprecated `ka.req.container.image`, `.image.repository`, `.privileged` keep their documented
  meanings (first regular container / any regular container).
- `eff_run_as_user`/`eff_run_as_group` fall back to the pod security context, not a sibling
  container, then to "0".
- Containers without a securityContext are skipped, not errors.
- Ephemeral lists do not advertise port values.
- The project's own watch tests pass on the pinned tree and after the fix.

## Test harness

Hidden Go tests staged into `plugins/k8saudit/pkg/k8saudit`. They use the real public
`Plugin.Fields()` / `Plugin.ExtractFromJSON` (the rule engine's field resolution) and read the
shipped rules file. A small in-test Falco-condition evaluator expands macros and lists and
evaluates the rule set over the event, resolving `ka.*` through the product extractor and
`jevt.value[...]` from the event JSON. This is test-side only; no product code is added.
`gopkg.in/yaml.v3` (already in the module graph) is warmed into the verifier cache.

## Verified during build

- Pin is the parent of the published fix (`git rev-parse 0adb9b3c^` == 14de2cb5).
- Pinned tree: `go test ./pkg/k8saudit -run TestOpen -count=1` passes (5 watch tests).
- Offline verifier simulation with `env -i`, `GOPROXY=off GOSUMDB=off CGO_ENABLED=1`: the build and
  both hidden suites run from the warmed module cache, including the `gopkg.in/yaml.v3` import
  (`gopkg.in/yaml.v3@v3.0.1` and `gopkg.in/check.v1@v0.0.0-20161208181325-20d25e280405` are warmed).

## Local variant matrix (injected tree, offline)

| variant | security | functional | declared |
|---|---|---|---|
| nop | 0/7 pass (all fail) | 9/9 hidden + 5/5 project | security_fail nop |
| oracle (`solution/fix.patch`) | 7/7 | 9/9 | pass |
| miss_subresource | 5/7 | 9/9 | security_fail L1 |
| miss_root_rule | 6/7 | 9/9 | security_fail L3 |
| miss_esc_rule | 6/7 | 9/9 | security_fail L4 |
| miss_init | 3/7 | 9/9 | security_fail (wrong object) |
| wrong_union | 7/7 | 6/9 | functional_fail L2 |
| wrong_refuse_all | 6/7 | 6/9 | functional_fail |
| pass_alt | 7/7 | 9/9 | pass |
| hardening | 7/7 | 9/9 | pass |

## Gate results (in order, `--only`)

- static: PASS.
- nop: PASS — security 0/7 (every security test fails on the pinned+injected tree), functional
  14/14 (9 hidden + 5 project tests).
- oracle: PASS — 3 runs, reward 1.0, identical results.
- patches: PASS — miss_subresource, miss_root_rule, miss_esc_rule, miss_init (security_fail,
  functional all pass), wrong_union, wrong_refuse_all (functional_fail), hardening, pass_alt
  (reward 1.0).

## Could not verify / open

- The advisory body itself was not available, only the screener summary.
- `present_in_latest` for the ephemeral-attachment route: not checked against current upstream.
- The real Falco engine is not executed in the verifier (offline, no driver). Rule conditions are
  evaluated by a test-side evaluator that supports the operator set the shipped rules use
  (`and or not in intersects exists startswith endswith contains = != < <= > >=`, quoted strings,
  numbers, booleans, macro and list names, field index/key arguments, `jevt.value[path]`). The
  shipped rules' YAML style (block/folded scalars, flow lists) is parsed with yaml.v3. Not
  supported: Falco rule `exceptions:` blocks and `override:` overlays. A fix that moves the
  trusted-image allowance into an `exceptions:` block instead of the condition would not be seen by
  the evaluator; the shipped idiom (a condition term) is what the tests and oracle use.
- Whether Kubernetes accepts `spec.ephemeralContainers` on pod create was not checked; the field
  extraction for that shape is tested, and the attachment route is tested through its own
  top-level request shape.

## Fairness notes

- The instruction states the property once and the naming contract for the field catalogue; it does
  not name any route, sibling, file or function. The concrete trigger is a privileged init
  container; the attachment route and the two injected settings are covered only by the general
  property.
- Estimated expert fix time is at the upper end of the ~45 minute bar because the work spans the
  field catalogue, extraction of three lists plus the attachment payload shape, and four rules.
