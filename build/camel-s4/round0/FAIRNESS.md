# camel-s4 — pre-trial fairness and leniency review

Reviewed: instruction.md, all 11 security + 10 functional task tests, Harness.java, runner/score.py,
solution/fix.patch, manifest.json, notes.md, checks/*.patch. No Docker, no trials, no upstream lookup.

## 1. Per-test fairness

| Test (file::name) | What it asserts | Covering instruction sentence | Could a correct fix fail? | Risk |
|---|---|---|---|---|
| security/SecStructuredTest.java::reservedNameInExactCaseIsIgnored | `CamelFileName` extension field is not a header; `myextension` kept; body delivered | "A field name supplied by a client must never become a message header that the framework reserves for itself … must be ignored"; "ordinary extension fields still become message headers" | no | low |
| security/SecStructuredTest.java::reservedNameInLowerCaseIsIgnored | same for `camelfilename` | "in any capitalization" | no | low |
| security/SecStructuredTest.java::reservedNameInUpperCaseIsIgnored | same for `CAMELFILENAME` | "in any capitalization" | no | low |
| security/SecStructuredTest.java::reservedNameCannotOverrideAStandardAttributeHeader | a reserved field cannot replace the `id`-derived `CamelCloudEventID` header | "must never become a message header that the framework reserves for itself"; "standard attributes still populate their usual headers" | no | low |
| security/SecStructuredTest.java::reservedNameIsIgnoredOnSpecVersion101 | reserved field dropped for specversion 1.0.1 | the property applies to every accepted CloudEvent ("Each accepted event becomes a Camel message"); no version exception | no | low |
| security/SecStructuredTest.java::reservedNameIsIgnoredOnSpecVersion102 | same for 1.0.2 | same | no | low |
| security/SecBinaryTest.java::extensionHeaderWithReservedNameIsIgnored | `ce-CamelFileName` dropped after `ce-` stripping; `ce-myextension` kept; `id` header; body | "whichever part of the request the client uses to carry it"; "ordinary request headers are still carried"; "must still be delivered to the route" | no | medium (binary carrier is not named; it is the sibling loop next to the attribute loop) |
| security/SecBinaryTest.java::extensionHeaderWithUpperCaseReservedNameIsIgnored | `ce-CAMELFILENAME` dropped | "in any capitalization" + "whichever part of the request" | no | medium |
| security/SecBinaryTest.java::extensionHeaderCannotOverrideAStandardAttributeHeader | `ce-CamelCloudEventID` cannot replace the `id`-derived header | reserved-name rule + "standard attributes still populate their usual headers" | no | low |
| security/SecSideEffectTest.java::structuredFieldDoesNotNameTheWrittenFile | body still written; no file named `sender-chosen.txt` | impact sentence + "accepted events are still written where they are written today"; "must be ignored" | no | low |
| security/SecSideEffectTest.java::binaryFieldDoesNotNameTheWrittenFile | same for the ce- carrier | "whichever part of the request the client uses to carry it" | no | medium |
| functional/FuncStructuredTest.java::standardAttributesBecomeMessageHeaders | `CamelCloudEvent*` attribute headers, content type, body | "the event's standard attributes still populate their usual headers, the declared data content type still becomes the message content type" | no | low |
| functional/FuncStructuredTest.java::ordinaryExtensionFieldsBecomeMessageHeaders | ordinary extensions (string/number/object/array) still become headers with their values | "ordinary extension fields still become message headers"; "Everything that works today must keep working exactly as it does today" | no | low |
| functional/FuncStructuredTest.java::ordinaryExtensionFieldsBecomeMessageHeadersOnSpecVersion101 | extension + version header on 1.0.1 | "Everything that works today must keep working exactly as it does today" | no | low |
| functional/FuncStructuredTest.java::ordinaryExtensionFieldsBecomeMessageHeadersOnSpecVersion102 | same on 1.0.2 | same | no | low |
| functional/FuncBinaryTest.java::standardAttributesBecomeMessageHeaders | attribute headers, content type, body (binary) | "Everything that works today…"; "standard attributes…" | no | low |
| functional/FuncBinaryTest.java::ordinaryExtensionHeadersBecomeMessageHeaders | `ce-myextension`, `ce-Another-Ext` become headers | "ordinary extension fields still become message headers"; "ordinary request headers are still carried" | no | low |
| functional/FuncBinaryTest.java::ordinaryRequestHeadersAreStillCarried | `X-Custom-Header`, `Authorization` carried | "ordinary request headers are still carried" | no | low |
| functional/FuncBinaryTest.java::binaryEventBodyIsDelivered | body delivered | "The event must still be delivered to the route and processed normally" | no | low |
| functional/FuncFileTest.java::structuredEventIsWrittenToTheFolder | a legitimate structured event is written | "accepted events are still written where they are written today" | no | low |
| functional/FuncFileTest.java::binaryEventIsWrittenToTheFolder | same, binary | same | no | low |
| (in functional group) org.apache.camel.component.knative.http.KnativeHttpTest — 162 parameterised project tests | the project's own structured/binary knative behaviour | "Everything that works today must keep working exactly as it does today." | no | low |

All assertions are observable behaviour on the real HTTP entry point (2xx, delivered message, written
file); none names an implementation, error class or status.

## 2. Leniency (QUALITY, non-blocking)

| Property / trap | Most plausible wrong fix | Caught by |
|---|---|---|
| T1 `T1_binary_extension_headers` | fix only the reported structured decoders; leave the `ce-` extension mapping | `SecBinaryTest` x3, `SecSideEffectTest::binaryFieldDoesNotNameTheWrittenFile`; checks/sf-miss-binary.patch |
| T2 `T2_spec_version_copies` | fix only the v1_0 decoder | `SecStructuredTest::reservedNameIsIgnoredOnSpecVersion101/102`; checks/sf-miss-versions.patch |
| T3 `T3_default_filter_is_a_noop` | bare `DefaultHeaderFilterStrategy` with no in-filter | all 11 security tests; checks/sf-bare-strategy.patch |
| T4 `T4_case_normalisation` | guard the raw key against the two obvious spellings | upper-case structured + binary tests; checks/sf-raw-case.patch |
| T5 `T5_attribute_headers_must_survive` | apply the reserved-prefix filter to the attribute writes too | `FuncStructuredTest::standardAttributes…`, `…101/102`, `SecStructuredTest::reservedNameCannotOverride…`, `KnativeHttpTest` structured [1-3]; checks/ff-overbroad.patch |
| delivery / not refused | refuse (4xx) or drop the event | `Harness.await` throws on non-2xx / no delivery; every security and functional test |
| legitimate behaviour | drop all extensions or all camel-prefixed headers | `FuncStructuredTest::ordinaryExtensionFields…`, `FuncBinaryTest::ordinaryExtensionHeaders…` |

**Wrong fixes no test catches.** (i) A closed list of known Camel header names (the two names the
suite exercises, or a "known internal headers" list) instead of the stated "starts with `Camel`"
rule passes every test. (ii) A guard applied only to String-valued extensions also passes.

## 3. Hints (QUALITY, non-blocking)

- "The example above is one example, not the full set." — flaw-count / variant hint. Neutral: delete;
  "Fix the problem and its close variants" already says it.
- "for example, to choose the name of a file that a route writes" — names the file consequence.
  Neutral: "…uses them internally to drive how the message is processed."
- "Other reserved names supplied the same way are applied too…" — neutral: fold into the reserved rule.

## 4. Required: generalize (step 3a)

none. The route-flavoured sentences report the observed impact and a behavioural keep-working
guarantee; they do not place a sibling/far site or an uncovered route. "Whichever part of the request
the client uses to carry it" is the general property over the protected outcome, not a route name.

## 5. Realism (QUALITY, non-blocking)

T2–T5 are real upstream code or real maintainer mistakes (the bare strategy is what the published
main-branch construction shipped; the code itself lowercases, so a raw-key guard is natural). T1 is
the only injected code: binary `ce-<name>` extension headers are a spec-defined CloudEvents binding
feature, the loop sits next to the real attribute loop, and it is reachable by a real HTTP POST to the
same consumer. Maintainer-plausible, not contrived; nothing keys off a test value. No flag.

## Verdict

**GATE A: READY.** A correct fix following the stated primary mechanism — ignore every client-supplied
field whose name starts with `Camel` in any capitalization, on every carrier; keep attribute-derived
headers, ordinary extensions, request headers and delivery — passes all 21 task tests and the 162
project tests. The reference fix and two independent designs (normalised-prefix check; transport-level
`ce-` rejection) score 1.0, so no test requires one implementation, error class or status. Every
"could a correct fix fail" cell is **no**; the medium binary-row risks are discoverability of the
carrier, which the instruction explicitly covers, not an unfair demand.

**Quality to tighten.** Add a security test with a reserved name the suite does not use (e.g.
structured `CamelCharsetName`, binary/side-effect `ce-CamelFileParent`) and one non-string reserved
extension (e.g. `CamelSplitIndex: 5`), fair under "every header name that starts with `Camel`"; this
closes both §2 gaps. Trim §3 wording. No realism change.

GATE_A: READY
NEEDS_HUMAN_REVIEW: NO
