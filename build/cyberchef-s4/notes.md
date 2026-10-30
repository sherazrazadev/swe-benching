# cyberchef-s4 — build notes

- Start (this build session): 2026-10-30T07:37Z
- End: 2026-10-30T08:00Z (all four gate stages pass)

Advisory GHSA-FX6F-382R-J72C / CVE-2026-57439, gchq/CyberChef.
Pinned (vulnerable) 50a7319b69ff6fd4473c8648fcaac1eeb3027dac; published fix 85db3be5d0096859b810f0e8d3e151d5dc9b948f (verified `85db3be^ == 50a7319` by fetching both commits; the fix diff is 3 files: Charts.mjs, Protocol.mjs, a new node test).
Track: injected. Pattern: A. Language: JavaScript (ESM `.mjs`), Node >=24 <25. Offline after image build.

## Mechanism (one line)
`getSeriesValues` writes CSV series/x text into plain `{}` maps (`series[serie][xVal] = val`), so a `__proto__`
first column writes the second column onto `Object.prototype`; the shared `objToTable` renders every object
with `for...in` and interpolates keys/values unescaped, so a polluted inherited key (or attacker text that
reaches it as a field) becomes live markup.

## Security property (written once, before choosing routes)
- P1 (shared-object integrity): no text taken from the data a recipe processes may become a property of
  an object shared between operations or built into the runtime; a value that happens to look like an
  internal object slot name is ordinary data and must live only on the operation's own result.
- P2 (safe table rendering): when a result is shown as a table in the output pane, the table may contain
  only the fields actually present on the data being shown, and every field name and value must be
  displayed as text (markup characters escaped, never interpreted).

These are two genuinely different protections (data integrity vs output encoding), not one per route.

## Lever candidates found (full list before picking)
Published (real, upstream):
1. `src/core/lib/Charts.mjs` getSeriesValues outer+inner plain maps and `for...in` list (REPORTED landing point).
2. `src/core/lib/Protocol.mjs` objToTable `for...in`, unescaped key/value, `typeof null === "object"` recursion (far site; callers Parse UDP/TCP/TLS present()).
3. `src/core/operations/ParseTLSRecord.mjs:34` constructor `for...in ContentType` writing `_contentTypes` (inherited keys leak into a numeric lookup; not the render sink) — not built on.
4. `src/core/operations/ExtractID3.mjs:157` present() `for...in` + unescaped tag id — OUTSIDE this advisory (screener out_of_scope note); noted only.
5. `src/core/operations/TextEncodingBruteForce.mjs:81` present() `for...in` + unescaped key — OUTSIDE this advisory; noted only.
6. `src/core/operations/ToTable.mjs:180` CSV cells into HTML unescaped — OUTSIDE this advisory; noted only.
7. `src/core/operations/ParseIPv4Header.mjs:112` fixed-field table — values are numeric/hex/IP, no attacker text; not the family sink.
8. Chart builders `getScatterValues` / `getScatterValuesWithColour` — they do not key maps by input text; no pollution shape.
9. Screener O8b idea: Parse TCP option map keyed by unknown wire Kind — Kind is one byte, keys stay fixed/numeric; no attacker text key, so it cannot reproduce the pollution or the text-in-table outcome. Rejected as unrealistic.
10. Screener O8b idea: a sibling renderer copied from objToTable — realised as injected sibling S1 below.
11. Screener O8b idea: a third chart builder grouping by a user label — realised as injected sibling S2 below, but as a table-producing operation so the grouping keys are real attacker text.

## Picks (2 published levers + 2 injected siblings)
- L1 (reported, HOW-type via coupled legitimate slot-name values + inherited-slot class): Charts.mjs getSeriesValues.
  `__proto__` series pollutes Object.prototype; `constructor` series writes onto the built-in Object function;
  an x value literally `__proto__` is legal data that the vulnerable code silently drops. Fix: own-prototype-free
  maps + own-key iteration, keeping slot-like text as own data. reason to dismiss: none (reported).
- L2 (far site A, HOW-type: escaping + own-key + nested shape): Protocol.mjs objToTable, reached by Parse UDP,
  Parse TCP and Parse TLS record present(). Fix: own keys only, escape every name/value after String(), keep
  recursing into real nested objects. reason to dismiss: a generic packet-table formatter unrelated to charts;
  once the chart side is fixed it reads as unnecessary (screener O3). Distance: another file.
- S1 (injected, second renderer implementation): new operation `Parse HTTP Headers` carries its own copy of the
  house-style `for...in` table renderer (no shared helper), so a solver who fixes objToTable and greps its
  callers never sees it. Covered by P2. Dismiss reason: "a separate operation with its own table code; I fixed
  the shared helper". Placed where the published fix never touches (new file).
- S2 (injected, second producer + renderer): new operation `Pivot table` builds a nested map keyed by two
  attacker text columns (`pivot[row][column] = value`) and renders its own HTML table with `for...in`. Covered
  by P1 and P2. Dismiss reason: "a table/formatting operation, not the Series chart and not a protocol parser".
  Placed where the published fix never touches (new file). Its grouping shape is the same anti-pattern as
  getSeriesValues, so a solver who fixes only that function misses it.

Why these beat the other candidates: 1 and 2 are the real upstream fix sites; S1 is a true second
implementation (strongest form A) and S2 is a second producer with real text keys. Candidates 3-7 are outside
this advisory, 8 has no keyed map, 9 has no attacker-text key.

## Sites / routes / input shapes the security tests cover
- Charts producer: `__proto__` series (pollution), `constructor` series (built-in function write), `__proto__`
  x value (legal own data, must not be dropped), through the Series chart operation and its data mapper.
- Protocol renderer: inherited enumerable key rendered with markup, through Parse UDP, Parse TCP (nested
  Options) and Parse TLS record present(); own key/value markup escaped (lower-level table API).
- S1 renderer: inherited key through Parse HTTP Headers present(); own header name/value markup escaped.
- S2 producer/renderer: `__proto__` row (pollution), `__proto__` column (own data preserved), markup in
  row/column/value escaped, inherited key not rendered, through Pivot table run()+present().

## Coupled must-keep-working (functional)
- Ordinary Series chart data still renders an SVG with every series label and x label (project's own tests).
- Series/x labels with spaces and punctuation still render; the project's own x-label escaping test still holds.
- Parse UDP/TCP/TLS tables still show their fields and still recurse into nested objects (Parse TCP Options).
- Scalar numbers/booleans still display in a table.
- Ordinary HTTP headers and ordinary pivot rows/columns still render as tables.

## Verified
- The flaw reproduces at the pinned commit locally (Node 24, real operation entry points): a `__proto__` series
  writes Object.prototype, a `constructor` series writes the built-in Object, objToTable renders inherited and
  unescaped keys/values, and the Series-chart -> Parse-UDP chain emits raw markup.
- The oracle (published fix + the two sibling fixes) passes the whole local suite; the injected vulnerable tree
  fails every security test and passes every functional test.
- Gate stages: static PASS; nop PASS (14/14 security fail on vulnerable, 14/14 functional pass); oracle PASS
  (3 identical runs, reward 1.0). patches PASS (all 13 check patches behave as declared).
- All 13 check patches were dry-run against the injected tree and validated locally against the hidden suite with
  the expected outcome (security_fail keeps functional green; functional_fail breaks at least one functional test;
  hardening/alternative score 1.0).

## Could not verify / caveats
- (filled in at the end)
