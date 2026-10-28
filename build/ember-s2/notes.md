# ember-s2 — build notes

Started: 2026-10-27T19:10:41Z (session marker); builder started ~2026-10-27T19:20Z.
Ended: 2026-10-27T19:55Z (gate stages complete; blind patch and FAIRNESS.md reserved for the pipeline).
Builder: build-v1, pattern A+B, track injected.

Candidate: `alexandre-daubois/ember` (Go 1.26, bubbletea/lipgloss TUI for Caddy/FrankenPHP).
Pinned: 9f19916c7aa0112310967b7b0ccee80da2eddc70. Published fix: fcb7160e58dba58d6f9b5033cc312fdedc8c9f6b.
Advisory: GHSA-X3G7-QRWC-F6C5 / CVE-2026-54162 / GO-2026-6270, CWE-150.

## What the product is

Ember is an operator dashboard in a terminal. It polls Caddy's admin API for metrics, derives
per-host/per-route/per-worker tables, reads certificates through Caddy's PKI admin API or a TLS
dial, and receives Caddy access/runtime logs over a TCP log sink. Request fields (URI, Host,
method, raw non-JSON lines) and certificate metadata are strings a remote client can influence.
The product renders them straight into the operator's terminal.

The published fix strips C0 (0x00–0x1F), DEL (0x7F) and C1 (0x80–0x9F) at every TUI render
sink through a new `internal/ui/sanitize.go` helper, and leaves the parsed values raw so the
JSON/metrics output, route-aggregation keys and typed filtering keep working. `ember diff` (a
non-interactive stdout report over JSON snapshots) is NOT touched by the fix.

## Security property (written once, general)

No value a remote client can influence — including a value the product stored or derived earlier
and later reads back — may reach the terminal with terminal control characters intact, wherever
the product writes it for a person. C0 controls, DEL and C1 controls must be removed before such a
value is written; the printable remainder must still be shown. Values the product exposes as data
— machine-readable output and the identities it groups, sorts or filters by — keep their exact
bytes. Printable values (emoji, CJK, accented Latin) keep their exact contents and display width.

Every route and sibling below is covered by this one property, read literally. It never names a
route, file, function, side or command.

## Levers (each with a DIFFERENT reason a solver would dismiss/skip it)

1. **L1 — clean at the draw boundary, not in the parser (HOW: coupled must-keep-working value).**
   Site: `internal/fetcher/logentry.go:ParseLogLine`, `internal/model/routepattern.go:NormalizeURI`
   (the tempting one-place fix) vs. the render boundary in `internal/ui`.
   Dismissal: "strip control bytes inside the parser/normaliser, then every consumer inherits the
   fix." Wrong: the parsed fields feed `--json`/JSONL (`internal/app/json.go`), route-aggregation
   keys (`model.RouteAggregator`) and the typed filter (`model.LogFilter` / `ui.activeLogFilter`);
   changing them corrupts machine output and merges/splits aggregation buckets and filter matches.
   Functional tests prove raw JSON, raw keys, raw filter matching; an over-narrow non-ASCII strip
   loses emoji/CJK. Security-fail variant: producer-level fix is a *functional* fail, not a
   security pass, because the hidden functional group rejects it.
   Wrong patches: `func_producer.patch` (functional_fail), `func_overbroad.patch` (functional_fail).

2. **L2 — the published fix's far sites (A; field-selection shapes).**
   The report leads to the access-log row (`internal/ui/logtable.go:formatLogRow`, through the
   shared `fitCellLeft`). The same protection is required at the other draws:
   `internal/ui/logtable.go` runtime rows (`Logger`/`Message`) and the `ParseError` raw line (the
   whole attacker-controlled line), `certificates.go` (displayed domain is `DNSNames[0]` and
   shadows `Subject`; plus `Issuer`), `hosttable.go` host column, `hostdetail.go` breadcrumb +
   Methods table, `routestable.go` method (bypasses the cell helper via `padCellRight`),
   `workerlist.go` + `detail.go` in-flight method/URI, `logsidepanel.go` host labels,
   `logs.go` per-host empty hint, `app.go` status/error line.
   Dismissal: "the row's URI is the reported field, and one helper covers every row" — the raw
   `fmt.Sprintf` sites and the alternate displayed field (DNSNames[0], RawLine) are missed.
   Wrong patch: `sec_miss_raw_rows.patch` (sanitises only the shared cell helpers).
   Shape trap inside L2: a narrow sanitizer that handles ESC/CSI sequences but not BEL, DEL or C1
   code points. Wrong patch: `sec_miss_c1.patch`.

3. **L3 — non-interactive terminal report (B: real upstream route where protection never existed).**
   `internal/app/diff.go:317` prints each per-host name from a snapshot to stdout with no
   neutralisation. The host is Caddy's per-host metric label, ultimately the Host header; Go's
   `encoding/json` escapes control bytes on the way into the file, but `json.Unmarshal` restores
   the raw bytes, so the sink is live. Dismissal: "diff is a text report over JSON files, not the
   TUI; JSON already escaped it." Registered in `build/audit/uncovered-routes.tsv`.
   Wrong patch: `sec_miss_diff.patch` (security_fail; all functional pass).

4. **L4 — plugin tab output and plugin error text (INJECTED; route where protection never existed).**
   A built-in "hostboard" plugin (`internal/plugins/hostboard`) implements Fetcher+Renderer and
   shows per-host request counts from Caddy's metrics. `internal/ui/plugin_bridge.go` returns the
   plugin's `View` text verbatim and `internal/ui/app.go` (default tab case, the group-error
   fallback) renders a plugin Fetch error verbatim. The published fix touches neither.
   Dismissal: "plugin text is third-party code; Ember only displays what the plugin returns."
   Wrong patch: `sec_miss_plugin.patch` (security_fail).

5. **L5 — derived display summary off the renderer's path (INJECTED; HOW: producer off the check's path).**
   The log-detail panel (`internal/ui/logdetail.go`, opened with Enter on a log row) draws a
   one-line request summary that `fetcher.ParseLogLine` assembles at ingest; the renderer never
   calls the parser. A solver who sanitises the panel's individual request fields misses the
   derived summary. Dismissal: "the summary is display text assembled upstream, not a raw request
   field." Wrong patch: `sec_miss_summary.patch` (security_fail).

## Injected sibling candidate list (search of the whole tree) and why the picks won

Screener O8/O8b leads:
- `internal/app/diff.go:317` per-host name to stdout — REAL; picked (L3, registered route).
- `internal/ui/app.go:356-360` plugin error text rendered raw — REAL; folded into L4.
- `internal/ui/upstreamtable.go:122-126` address/health/LB via fmt.Sprintf — rejected: values come
  from operator-authored Caddy config, not request/log data; no client influence to test.
- `internal/ui/config.go:359-364` raw JSON key — rejected: same reason (operator-authored config);
  making it attacker-reachable would need a remote config source the product does not have.
- `internal/ui/plugin_bridge.go:100-107` plugin View verbatim — REAL; picked (L4).
- `internal/app/diff.go:314-319` export-style printer — same code as the picked diff route.

Own search:
- `internal/app/status.go` text line — numbers/counts only, no external names. Rejected.
- `internal/app/init.go`, `wait.go`, `version.go` — config/release/address strings, not client
  influenced. Rejected.
- `internal/ui/renderConnectionError` — takes the error but never renders it (unused parameter).
  Rejected: not a sink.
- `internal/ui/graph.go`, `help.go`, `tabbar.go`, filter line — numeric/static/operator input.
  Rejected.
- runtime/server logs — already covered by the published fix (`formatRuntimeLogRow`). Not a sibling.
- Prometheus exporter / daemon slog — non-terminal HTTP/stderr sinks; out of the advisory's
  terminal protection. Noted outside scope.
- Injected picks: plugin bridge (L4), log-detail summary (L5). Both are code a maintainer could
  plausibly have written, reachable through the real TUI entry point, covered by the one property,
  and untouched by the published fix. The hardest/most how-type were preferred (L5 producer path,
  L4 responsibility boundary) over plain extra rows.

## What the security tests cover (one per site/route/shape)

Driven through the real render/command paths:
- real TCP log sink → `ParseLogLine` → `LogBuffer` → `App.View()` access row (URI/host/method);
- raw non-JSON line (`ParseError`/`RawLine`) in the access and runtime tables;
- runtime `Logger`/`Message`;
- status line from a snapshot `Errors` entry and from a fetch error;
- Certificates tab (DNSNames[0] shadowing Subject + Issuer);
- Caddy host table, host-detail breadcrumb and Methods table;
- By Route table method + pattern; sidepanel host label; per-host empty hint;
- FrankenPHP worker list and detail panel (method/URI);
- `ember diff` real cobra command over two snapshot files;
- plugin tab rendered text and plugin Fetch error text (injected);
- log-detail summary panel (injected);
- control shapes: OSC BEL/ST, CSI, CR/LF/TAB/NUL, DEL, C1 supplied as UTF-8 code points, in and
  around the payloads.

## Coupled functional tests (must keep working)

- `buildJSONOutput` (JSON/JSONL) keeps control bytes in host and thread URI/method verbatim.
- Route aggregator keys keep raw host/method and `NormalizeURI` output; the typed filter matches a
  raw value containing a control byte.
- Certificate sorting (issuer) and filtering use raw values.
- Emoji/CJK/accents keep exact contents and 2-cell display width in the table helpers and renders.
- Clean rows keep their visible text; `ember diff` keeps its legitimate host and numbers; plugin
  tab and log-detail panel render legitimate text unchanged.
- The project's own tests for the affected area (`internal/ui`, `internal/app`,
  `internal/fetcher`, `internal/model`) are re-run from pristine copies.

## Verified on the pinned copy

- `go build ./...` and `go test ./...` pass at the pinned commit (Go 1.26.0, local toolchain), at
  the pinned+injected tree and at the reference-fix tree.
- The diff leak was confirmed by a scratch test (BEL/OSC survive into stdout at the pinned commit).
- expfmt parse errors quote raw tokens rather than emitting them unescaped; the plugin-error route
  was therefore made to carry the raw body of a non-200 admin answer, which the plugin reports in
  its error message. Confirmed leaking at the pinned+injected tree and closed by the oracle.
- On the pinned+injected tree every hidden security test fails (29 JUnit cases, including
  subtests) and every hidden functional + project test passes; on the oracle the same run is
  green (30 security cases, 11 hidden functional + 1349 project cases).
- Every checks/ patch was applied to the injected tree and run against the hidden groups:
  - sec_miss_raw_rows / sec_miss_c1 / sec_miss_diff / sec_miss_plugin / sec_miss_summary and
    crash_as_refusal: security fails, functional (hidden + 1349 project tests) all pass.
  - func_producer (JSON, route keys, filter), func_overbroad (emoji/CJK), refuse_all: functional
    fails (refuse_all also fails security).
  - hardening and alt_fix: reward 1.0 on both the hidden and the project suites.
- `solution/fix.patch` applies cleanly with `patch -p1` to a fresh injected tree and builds.
- Static gate (`gate.py ember-s2 --only static`) passes. The environment injection is shipped
  base64-encoded because a plain diff of Go source shares import lines with the Go test files and
  trips the image-leak heuristic; the Dockerfile decodes and applies it, and the agent still sees
  the plain source in /workspace.
- The grading images expose the official Go toolchain at /usr/local/bin so it resolves under the
  verifier's minimal PATH.

## Gate results (run one stage at a time, as instructed)

- static: PASSED (`gate.py ember-s2 --only static`).
- nop: PASSED. Every security test fails on the untouched (injected) tree; every functional and
  all 1349 project testcases pass.
- oracle: PASSED. Three strict-gate runs all reward 1.0 with identical results.
- patches: PASSED, 11/11 declared checks behaved as declared:
  sec_miss_raw_rows / sec_miss_c1 / sec_miss_diff / sec_miss_plugin / sec_miss_summary /
  crash_as_refusal = security_fail (functional all pass); func_producer / func_overbroad /
  refuse_all = functional_fail; hardening and alt_fix = reward 1.0.
- `blind_fix.patch` is declared in the manifest but intentionally not written by the builder (the
  pipeline's blind-fix step produces it); static accepts the declared kind and the patches stage
  skips the missing file. FAIRNESS.md is likewise written after the trial.

## Could not verify

- Upstream current-code state for the diff route (`present_in_latest` unknown; the clone is the
  pinned tree only).
- The advisory body beyond the supplied summary.
- Target-model trial outcomes (DeepSeek V4.1 Flash / MiMo-V2.6-Pro) are run by the pipeline, not by
  the builder.

