# camel-s4 — build notes (build-v1, pattern A, injected)

Start (UTC): 2026-10-30T05:14:28Z
End (UTC): 2026-10-30T06:44Z

## Advisory scope

GHSA-VVWM-3J43-7PFM / CVE-2026-63621, CWE-20 — Apache Camel knative consumer: a field name taken
from an untrusted CloudEvent is reused verbatim as a message header. Pinned
`54cee749aa192073f72e4cb996305a98a42ad632`; the 4.14.x published fix is
`4eb26807d40420abf45253286ce3d07c2fba448c` (the other two commits are the 4.18.x and main
backports, whose trees differ from the pinned branch). Read-only work only: the task pins the 4.14.x
tree; no other branch was used as a source.

## Security property (stated once, general)

A field name supplied by a client must never become a message header the framework reserves for
itself (every name starting with `Camel`, in any capitalization). Such a field is ignored whichever
part of the request carries it; the event is still delivered and processed. Everything else keeps
working: standard attributes, the declared data content type, ordinary extension fields, ordinary
request headers, and the events the route writes today.

## Levers (each with a different reason to dismiss)

L1. Binary content-mode extension headers (INJECTED, how-type). A `ce-CamelFileName` request header
    passes the transport filter (the whole name is not reserved), the consumer strips `ce-`, and the
    remainder becomes a message header. Dismissal: "binary-mode request headers are already filtered
    by the transport, and the report is about the JSON payload". `AbstractCloudEventProcessor.java:71-84`.
L2. The three spec-version decoders (real upstream, where-type). The report's example is specversion
    1.0; 1.0.1 and 1.0.2 have textually identical loops. Dismissal: "the loops are identical, one fix
    covers them" (it does not unless they are all changed). `CloudEventProcessors.java:55-59,82-86,109-113`.
L3. A bare `DefaultHeaderFilterStrategy` filters nothing at this commit (mechanism, how-type). Its
    in-bound filter defaults are empty (`DefaultHeaderFilterStrategy.java:62,323-325`), so the most
    framework-idiomatic guard accepts every name. Dismissal: "the framework's own default filter must
    know about framework headers". This is the fix the published main-branch commit ships; on this
    branch the strategy has to be configured.
L4. Case normalisation (shape, how-type). The code lowercases the name before storing it, and message
    headers are case-insensitive (`DefaultHeadersMapFactory`), so a guard on the raw key misses
    differently-cased names. Dismissal: "the name is already lowercased".
L5. The standard attribute headers share the reserved prefix (coupled must-keep-working). An
    over-broad filter applied to every header write drops `CamelCloudEventID`/`Source`/`Type`/... and
    the content type. Dismissal: "the reserved prefix rule applies to every header".

## Sites / routes / input shapes covered

- Structured JSON event, specversion 1.0/1.0.1/1.0.2, reserved extension in exact, lower and upper
  case; ordinary extension kept; an extension cannot replace the attribute-derived header.
- Binary event: `ce-CamelFileName` and `ce-CAMELFILENAME` dropped after prefix stripping;
  `ce-myextension` and ordinary request headers kept; `ce-CamelCloudEventID` cannot replace the
  `id`-derived header.
- File-writing route: the sender-chosen file name is never used, and the event is still written
  (structured and binary).

## Injected siblings: candidates considered, and why the pick won

Candidate list found by searching the knative consumer/producer and the CloudEvent modules for
sender-controlled names that become message headers:

1. Binary content-mode extension headers (`ce-<name>`) in `AbstractCloudEventProcessor.consumer` —
   PICKED (L1). Realistic (the CloudEvents HTTP binding defines extensions as `ce-` headers, and the
   feature is the obvious parity with structured mode); reachable through the same knative consumer
   over the real HTTP transport; its name is already filtered-looking to the transport, which is the
   dismissal; not touched by the published fix (which edits the structured calls and the shared
   helper, not the binary branch).
2. Batch structured decoder (`application/cloudevents-batch+json`, currently an explicit
   `UnsupportedOperationException`). Rejected: a correct batch implementation would decode each event
   through the same `decodeStructuredContent`, so it is closed by the reference fix and is not a
   sibling; a version with its own mapping loop is not maintainer-plausible.
3. Inbound CloudEvent-JSON data-type transformer in `camel-cloudevents` (the module owns the outbound
   direction). Rejected: reachable only from a route's data-type step, not from the knative consumer;
   after the knative consumer has decoded the event the body is `data`, so the transformer never sees
   the event JSON. Not reachable through the real entry point.
4. HTTP request cookies / form fields exposed as message headers in `KnativeHttpConsumer.toMessage`.
   Rejected: no such feature exists and none of the neighbouring loops would omit the filter
   plausibly; also out of the advisory's protection (a transport concern, not a CloudEvent field).
5. Producer response headers copied into the exchange (`KnativeHttpProducer`). Rejected: the remote
   service is the peer, not the sender named by the advisory; it is a direction variant, which the
   design forbids as a new lever.
6. A second transport (`KnativeConsumerFactory`) that skips the HTTP header filter. Rejected: large
   new subsystem, not maintainer-plausible as a small addition, and would move the entry point away
   from the one the report names.

Picked: #1 only. It is the one candidate that is both realistic and a genuine gap not closed by the
reference fix. The other levers are the published far sites (three copies) plus two mechanism/shape
traps and the coupled over-broad trap.

## Coupled must-keep-working (functional)

- Standard attributes still populate `CamelCloudEventID/Source/Type/Version/Subject/SchemaURL/Time`;
  `datacontenttype` still becomes `Content-Type`.
- Ordinary extensions (string, number, object, array) still become headers; binary `ce-myextension`
  still becomes `myextension`; ordinary request headers are still carried.
- A legitimate event is still written to the folder, in both content modes.
- The project's own `KnativeHttpTest` (162 tests) still passes.

## Test harness

JUnit 5. Each test starts an in-process Vert.x platform-http server and a `knative:` consumer route
(the real HTTP transport, the same setup the project's own `KnativeHttpTest` uses), posts a real
CloudEvent with REST-assured, and reads the message the route received (a snapshot taken in the
route, because the reply path removes CloudEvent headers afterwards). Security tests assert the
reserved header is absent and the event still arrived; the two side-effect tests assert the
sender-chosen file name never appears while the body is still written. Functional tests exercise the
attributes, extensions, request headers and the file route; the functional group also compiles and
runs the project's own `KnativeHttpTest` from a pristine copy baked into the verifier image.

The verifier image pre-builds the pinned tree once; at grade time only the files that differ from
the pristine manifest are recompiled (`javac`), then the suites run with the JUnit console launcher.

## Oracle

Published 4.14.x fix (shared `mapExtensionAsHeader` helper applying an in-bound header filter strategy
configured with `CAMEL_FILTER_STARTS_WITH`, used by all three structured decoders) plus the same
helper used for the injected binary extension mapping. `solution/fix.patch`.

## Verified

- Pinned+injected tree: 11/11 security tests fail, 10/10 functional tests pass, `KnativeHttpTest`
  162/162 passes (local JVM, jars from the offline Maven build).
- Reference fix: 11/11 security pass, 10/10 functional pass (local JVM).
- Check patches: sf-miss-binary 4 security failing / functional clean; sf-miss-versions 2/clean;
  sf-bare-strategy 11/clean; sf-raw-case 2/clean; ff-overbroad 3 functional failing; pass-alt and
  pass-hardening all green. All checked with the same patch-classes overlay the verifier uses.
- Gate (per-stage runs, in order): static PASSED; nop PASSED (11/11 security fail, 172/172
  functional pass); oracle PASSED (3 runs, reward 1.0, identical results); patches PASSED (7/7:
  sf-miss-binary security_fail with functional clean, sf-miss-versions security_fail with functional
  clean, sf-bare-strategy security_fail with functional clean, sf-raw-case security_fail with
  functional clean, ff-overbroad functional_fail, pass-alt 1.0, pass-hardening 1.0). A full gate
  (all stages in one run) then PASSED 2026-10-30T06:43:51Z; build/camel-s4/gate_report.json
  records verdict pass with all four stages ok.

## Could not verify / guesses

- `repo_mb` was not meaningful to measure on the pinned checkout (the tree is far above 5 MB).
- The environment image was built on this host (Maven 3.9 from the base image); the verifier image's
  Maven build of the pristine tree was verified locally with Maven 3.9.9 before the Docker build.
- The `ce-` extension mapping is an injected feature, not upstream code; its behaviour on the pinned
  tree was verified behaviourally, not from upstream history.
- No Windows/ARM64 build was checked.
- A solver could place a correct fix in a module whose source is not recompiled by the verifier
  (outside the changed-file overlay); only files that differ from the pristine tree are recompiled,
  which covers every changed file, so this is not a real gap — but a fix that relies on rebuilding a
  *generated* source would not be picked up (no generated sources are involved here).

## Out of scope (one line)

`KnativeHttpProducer` copies remote response headers into the exchange (it filters them); the
`KnativeHttpSupport.createFilter` server-side regex option and other Camel components' header
handling are outside this advisory and were not built on.
