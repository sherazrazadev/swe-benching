# logging-operator-s2 — build notes

- Start (UTC): 2026-10-27T19:10:13Z
- End (UTC): 2026-10-27T20:15:00Z

## Source

- Repo: kube-logging/logging-operator
- Pinned (vulnerable): 8c34e9a61e6587f15acbf147fc1be895898c6b67 (verified: parent of the fix)
- Published fix: cf437d7f1e056c78740bf5716ac8bdebcf002425 (`pkg/sdk/logging/model/render/fluent.go`,
  adds `validateFluentToken` / `escapeFluentValue` and `fluent_injection_test.go`)
- Track: injected (injected siblings in the image, published fix taken as the oracle's base)

## The protected outcome

The fluentd configuration text the operator generates from its logging configuration objects
(cluster-wide logging settings and per-namespace flow/output resources).

## The one property (written once, before routes were chosen)

No string supplied for a single fluentd configuration setting may end the line it is written on
or open, close or re-target a directive: it must stay one value of that setting in the
configuration the operator generates, whatever object supplies it and however it reaches the
generator. If a supplied value cannot be represented that way, generation must fail with an error
and no configuration may be produced. Values without a line break keep producing exactly the
configuration they produce today, including structured values.

Every route and every injected sibling below is an instance of this one property. The report never
mentions a file, package, function, field or route.

## Levers (each with a different reason a solver would dismiss/skip it)

1. **base — parameter value (published landing point).** `pkg/sdk/logging/model/render/fluent.go:64`
   (`%s %s`, k, params[k]). Tenant Output/Flow field values. Dismissal: none, this is the report.
2. **structural tokens (Pattern A far site).** The directive header and meta lines at
   `pkg/sdk/logging/model/render/fluent.go:47,52-58` take CR strings: `Flow.Spec.FlowLabel` ->
   `PluginMeta.Tag` (`pkg/sdk/logging/api/v1beta1/flow_types.go:43`,
   `pkg/sdk/logging/model/types/flow.go:129`); filter `match_tag` ->
   `PluginMeta.Tag` (`pkg/sdk/logging/model/filter/tagnormaliser.go:99`,
   `pkg/sdk/logging/model/filter/detect_exceptions.go:121`); relabel output `label` ->
   `PluginMeta.Label` (`pkg/sdk/logging/model/output/relabel.go:112`). Dismissal: these look like
   identifiers/plugin-specific fields, not parameter values; `match_tag` is `plugin:"hidden"` and
   looks derived.
3. **derived values (how-type; producer off the check's path).** (a) `filter.Record`
   (`pkg/sdk/logging/model/filter/record_transformer.go:93-101`, `record_modifier.go:118-125`)
   assigns the user map straight to `Params`, so a user key becomes a parameter *name* and never
   passes through `StructToStringMapper`; (b) secret-loaded values enter `Params` inside the mapper
   (`pkg/sdk/logging/model/types/stringmaps.go:109-118`) from a Kubernetes Secret the tenant owns;
   (c) selector lists are comma-joined and label maps colon-joined by
   `FlowMatch.GetParams` (`pkg/sdk/logging/model/types/router.go:68-103`) and JSON-marshalled in the
   builder. Dismissal: they are machine-produced or secret data, not literal configuration strings;
   and quoting them generically breaks the label_router consumer.
4. **cluster-wide config files (route where the protection never existed).** `pkg/resources/fluentd/config.go:33-81`
   is an `html/template`; newlines are preserved (only HTML metacharacters are escaped), so
   `FluentdSpec.RootDir` / `Ignore*LogInterval` / `Metrics.Path` inject parameter lines into
   `input.conf` (`pkg/resources/fluentd/configsecret.go:61-92`). Dismissal: cluster-admin-only
   fields, and the template "already escapes".
5. **injected sibling 1 — extra `<system>` parameters.** `FluentdSpec.SystemParameters map[string]string`
   written by a hand-written formatter in `pkg/resources/fluentd/config.go` and inserted into
   `input.conf` in `configsecret.go`. Dismissal: trusted admin tunables; not a user value.
6. **injected sibling 2 — extra include files.** `FluentdSpec.ConfigIncludes []string` appended as
   `@include <path>` lines to the generated `fluent.conf`. Dismissal: "it is only a list of paths".

## Candidate list considered and why the picks beat the rest

Fluid all fluentd config writers found by search (`@include`, `<match`, template/`fmt.*f`):

- `render.FluentRender.RenderDirectives` parameter line — picked (base).
- same function, header/meta lines — picked (lever 2).
- `Record.ToDirective` params (record_transformer/record_modifier) — picked (lever 3a).
- `StructToStringMapper` secret load — picked (lever 3b).
- `FlowMatch.GetParams` joins and JSON metrics labels — picked (lever 3c, coupled functional value).
- `pkg/resources/fluentd/config.go` html/template -> input.conf — picked (lever 4).
- `pkg/resources/fluentd/configsecret.go` `fluentLogDestination` -> fluentlog.conf (fmt.Appendf) —
  rejected: the field is CRD enum-constrained (`stdout,null`), so a real API server rejects a
  newline value; not reachable through the real entry point.
- `logging.spec.flowConfigOverride` (raw config replacement) — rejected: documented deliberate raw
  override; the property is about values written for single settings, not whole-config overrides.
- `pkg/resources/fluentbit/configsecret.go` (text/template, node agent) — rejected: different daemon,
  outside this advisory's protection; recorded out of scope, not built on.
- `pkg/sdk/logging/model/syslogng/config/render/helpers.go` `StringList`/`ArrowMap` — rejected:
  different backend/daemon, outside this advisory's protection; recorded out of scope, not built on.
- `FluentdSpec.LogLevel`/`LogFormat`/`FluentLogDestination` enums — rejected (CRD blocks newlines).
- `PluginMeta.Id` — computed from namespace/name (DNS), not attacker-controlled.
- `PluginMeta.Type`/`Directive` — static literals in every plugin.

Injected siblings had to be cluster-wide: the fluentd resources layer receives only the rendered
config string, never tenant CRs, so a plausible injected writer there cannot be tenant-fed.
The two injected options are different shapes (a map value and a list element) in different
generated files (`input.conf` vs `fluent.conf`).

## Verified

- The flaw reproduces at the pinned commit through the controller's real pipeline (`model.CreateSystem`
  + `render.FluentRender.Render`): a newline in an output value, in a record-map key, in a flow
  label, in a filter match tag and in a relabel target each produce an extra configuration line
  (verified in a container against the pinned tree).
- The cluster-wide template route reproduces through `fluentd.Reconciler.generateConfigSecret`
  (`FluentdSpec.RootDir` with a newline adds `metrics_path` to input.conf).
- Both injected siblings reproduce through the same function (a system-parameter value/key and an
  include path each add configuration lines).
- Hidden suites: 14 security tests fail by assertion on the pinned+injected tree and pass on the
  oracle; 9 functional tests plus the 6 project render tests pass on both (verified locally and
  through the real verifier image: nop reward 0.0 / 29 tests, oracle reward 1.0).
- Patch checks behave locally as declared: alternative and hardening pass; the three lever-missing
  patches fail only their own security tests with all functional tests passing; the two
  over-broad patches fail functional tests.
- The fix commit's regression test (`pkg/sdk/logging/model/render/fluent_injection_test.go`) is not
  present at the pinned commit; it is added by cf437d7f. Current upstream still contains the fixed
  renderer and still contains the cluster-wide template writer, so that route is present in latest.
- Gate stages: static PASSED; nop PASSED; oracle PASSED (3 identical runs, reward 1.0); patches PASSED.

## Could not verify

- Whether the two injected options would be accepted by a real API server depends on the CRD YAML,
  which was updated by hand (controller-gen was not run). The Go tests do not read the CRDs.
- The exact runtime behaviour of fluentd's parser for a bare carriage return was reasoned, not
  executed; the tests treat CR as a line terminator, and the published fix does the same.
- Whether current upstream fixed the cluster-wide template route in a later release: no later
  commit touching those files exists in the clone's master, so it is still present.

## Out of scope (not built on)

- `pkg/resources/fluentbit/configsecret.go` (node-agent config, text/template, no escaping):
  different daemon.
- `pkg/sdk/logging/model/syslogng/config/render/helpers.go` (`StringList`/`ArrowMap` splice raw):
  different backend/sink.
- `logging.spec.flowConfigOverride` (raw whole-config override) and `FluentLogDestination`
  (CRD enum-constrained): not reachable as a single-setting value injection.
