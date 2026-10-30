# spring-ai-s4 — build notes

- Start (UTC): 2026-10-30T00:16:20Z
- End (UTC): 2026-10-30T00:44:46Z

## Advisory and pinned state

GHSA-CMWH-W62W-R2MF / CVE-2026-47835, spring-projects/spring-ai, CWE-943. Pinned commit
`b28642fb735e79f663aa03e25c8ad1eddcf0a5cc`; published fix `2b20cfc8…` (main line; `9787991…` is the
1.0.x twin with the identical four-case addition). The published fix adds `\t`, `\n`, `\r` and
U+3000 to the shared Lucene escaper. Pinned tree reproduced behaviourally before any change: those
four characters reach the generated query string unescaped for field names in all three
Lucene-backed integrations and for values in the two integrations whose values are unquoted.

Verified that the classic query parser's whitespace set is exactly space, `\t`, `\n`, `\r` and
U+3000 (grammar fetched from upstream Lucene), which is why the screener's O8 (U+00A0/U+2003/
U+2028/U+202F) is not a real separator for these stores and was not built.

## Levers (one line each)

- T1 / pattern A — far site + value shape: caller-supplied values reach the same shared escaper;
  a fix that only escapes the reported field-name path leaves scalar and IN/NIN values open in
  OpenSearch and GemFire (`AbstractFilterExpressionConverter.java:246`, GemFire doSingleValue).
  Reason to dismiss: the report shows a field name, and values read as data.
- T2 / pattern B (injected) — compound-key split: OpenSearch splits a dotted field name at the
  first dot and emits the namespace segment raw (`OpenSearchAiSearchFilterExpressionConverter.java`
  doKey:88-98). Reason to dismiss: dotted names look structural and the segment after the dot is
  escaped.
- T3 / pattern B (injected) — already-quoted value form: GemFire strips outer quotes from a value
  and appends the inner text unescaped (`GemFireAiSearchFilterExpressionConverter.java` doSingleValue
  :127-138). Reason to dismiss: the caller quoted it, so it looks like an intentional literal.
- T4 / pattern B (injected) — separate existence query: Elasticsearch's null/not-null form composes
  its field term directly (`ElasticsearchAiSearchFilterExpressionConverter.java` doExists:67-78).
  Reason to dismiss: a different query form with its own composition.

No real unmodified-upstream Pattern B route was found: the value positions are real upstream code
but are fixed by the published shared-helper change (Pattern A); the exotic-whitespace lead is not a
separator in this grammar. The Pattern B levers are therefore injected siblings, registered in
`build/audit/uncovered-routes.tsv`.

## Full candidate list (found by searching the repository) and why the picks won

1. Shared Lucene escaper (`emitLuceneString`) — the reported published-fix site, not a sibling.
2. OpenSearch unquoted values — real, covered by the published fix; chosen as T1 (value shape).
3. GemFire unquoted values — real, covered by the published fix; part of T1.
4. Elasticsearch quoted values — a tab/newline inside a quoted phrase is legal in the classic
   parser and cannot add a clause; rejected (no behavioural route).
5. Non-`String` values appended via `toString` — real upstream, but the documented entry points
   produce typed scalars; a hostile object needs a hand-built `Filter.Value`, so not fairly
   reachable through a normal caller route; rejected.
6. Filter text parser route — real and kept as extra security tests (text-supplied filters), but it
   feeds the same sink and the same fix covers it; not a separate lever.
7. Exotic Unicode whitespace (screener O8) — not separators in this grammar; rejected, register row.
8. GemFire OQL single-quote breakout — a different protection, outside this advisory's
   whitespace family; not built (scope note).
9. Other vector stores (Redis, Typesense, Azure, Weaviate) — carry their own identifier rules and
   are outside the advisory; not built.
10. Injected: OpenSearch compound-key namespace raw — chosen as T2 (separator split, how-type).
11. Injected: GemFire already-quoted value pass-through — chosen as T3 (shape trap, how-type).
12. Injected: Elasticsearch existence/absence raw field term — chosen as T4 (route where the
    protection never existed).
13. Injected: a duplicate stale value escaper — considered and dropped: it repeats T1's value-shape
    concept and is a pure where-type second copy.
14. Injected: non-`CharSequence` value pass-through — considered and dropped (weak realism).
15. Injected: post-escape normalisation (lowercase/trim) — no natural normalisation step exists;
    dropped as artificial.
16. Producer off the check's path (schema/config/parser) — the converter consults no producer it
    trusts, and the parser's output goes through the same escaper; not available without
    fabricating a design.
17. Ordering lever (check before an adjustment) — no adjustment step exists between caller text
    and the sink; not available.

The three picks beat the others because each is reachable through the public filter-conversion API,
changes no legitimate output (so the project's own 47 converter tests and the functional suite pass
on the pinned tree), and has a distinct reason a solver would skip it: a split on a separator, a
caller-supplied quote shape, and a separate query construct. T2 and T4 are how-type (the fix needs
the mechanism, not just the site); T3 is a shape trap.

## Gate result (2026-10-30)

- static PASSED; nop PASSED (22/22 security failing, 57/57 functional passing); oracle PASSED (3 runs, reward 1.0, identical); patches PASSED (9/9 as declared). Partial reports: `gate_report.{static,nop,oracle,patches}.json`.

## What was verified

- Flaw reproduces on the pinned tree through the real public conversion API for keys (all three
  integrations) and values (OpenSearch, GemFire), scalar and list.
- Pinned + injection: 0/22 hidden security tests pass, 57/57 functional pass (local JVM and the
  actual verifier container).
- Reference fix: 22/22 security, 57/57 functional, reward 1.0 (local JVM and container; two
  identical container runs were not needed because the suites are deterministic pure functions).
- Every check patch behaves as declared in the container: sf_published_only 16/22 security,
  sf_misses_values 18/22 (the four OpenSearch value cases), sf_misses_s2/s3/s4 20/22 each (functional green for all five);
  ff_refuse_all and ff_overbroad fail functional; pass_hardening and pass_alternative reward 1.0.
- The project's own three converter test classes pass at the pinned commit (47 cases).
- Both Docker images build from the pinned commit; the verifier runs offline against `/opt/m2`.

## What could not be verified

- No live Elasticsearch/OpenSearch/GemFire server was used. The hidden tests exercise the real
  public conversion API (the string the stores send), and the separator set was taken from the
  upstream classic-parser grammar, not from a running cluster.
- GemFire OQL's exact whitespace set for exotic Unicode spaces is unknown; the GemFire security
  tests use only tab/newline/carriage return, which every Java-family grammar treats as separators.
- Model outcomes (the bar) are not knowable from this build; no trials were run here by design.

## Scope note

Nothing outside this advisory's protection (whitespace separators in the Lucene-style metadata
filter query string) was pursued; the single-quote/OQL and non-Lucene-store families were noted and
left alone.
