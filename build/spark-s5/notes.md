# spark-s5 build notes

- Start UTC: 2026-10-28T23:51:08Z (build/spark-s5/start_utc.txt)
- End UTC: 2026-10-29T00:17:46Z

## Shape

Injected-track, pattern B task on `apache/spark`, pinned at
`dc5bb9641b6e6fb8f55b1c524b3a21d4b5063283` (verified through the GitHub API as the first parent of
the master fix `e739b7d349dbd41b78d49bc8086cab63db057e14`; `3c83c2c6a22fe384280b99bb753b14800b7e27e1`
is the same 12-line change cherry-picked to branch-4.1). Both published commits modify only
`core/src/main/resources/org/apache/spark/ui/static/historypage.js` (11 insertions, 1 deletion) and
add no regression tests, so the pinned tree contains none.

The report's protection is the history server's client-rendered application listing. The task adds
two realistic siblings (a multiple-attempt notice and a download-control tooltip) to that page and
keeps every real sibling sink of the same listing. The reference fix escapes each event-log-derived
value at the point where it becomes HTML and keeps ordinary rows, destinations, tooltips, notices,
ordering and the expanded text working.

## Security property (written once, before the routes)

"No value taken from an application's event-log record may be interpreted as markup by the history
page. Each such value must appear as the literal text it is, and no element or attribute it carries
may take effect. Displaying such a value is ordinary: it must not raise an error or fail the page,
and a value must not be silently dropped or rewritten." Every real route and both injected siblings
fall under it as written; the report never describes where any of them lives.

## Levers (one line each)

- T1 (advisory route, how-type shape) - `historypage.js:138,196` / `utils.js:276-287,238-247` - the
  application name is kept raw; a name longer than the abbreviation limit is inserted a second time
  in the expanded details `<pre>`, so escaping only the returned summary leaves it live; escaping
  the composed cell instead breaks the expander. Reason to dismiss: the report names names, and the
  obvious place to escape is the string the render returns.
- T2 (uncovered upstream, route where protection never existed) - `historypage.js:211` - the Spark
  user is a bare DataTables `data:` column written as HTML. Reason to dismiss: the report is about
  names and the framework supplies the user, so the column looks out of scope.
- T3 (uncovered upstream, how-type coupled value) - `historypage.js:191,151-169,81-94` - the app id
  is in the title attribute, anchor text, attempt/log destinations and the `appid-numeric` sort key;
  escaping visible text alone leaves the attribute/destination breakouts, and over-escaping the
  composed cell breaks the link and the sort. Reason to dismiss: ids look cluster-manager generated
  and must stay raw to build destinations and sort.
- T4 (uncovered upstream, coupled value) - `historypage.js:201,151-169` - the attempt id is in the
  text and the attempt/log destinations. Reason to dismiss: attempt ids look resource-manager owned.
- T5 (uncovered upstream, route where protection never existed) - `historypage.js:186` - the Spark
  version is a bare `data:` column read from the event log's log-start header. Reason to dismiss:
  the version looks like a build constant that can never carry attacker input.
- I1 (injected sibling, attribute sink) - `historypage.js:216-217` - the event-log download control
  names the application in a tooltip attribute built from the same raw row value. Reason to dismiss:
  the tooltip is on a different column and escaping the value where it is displayed looks enough.
- I2 (injected sibling, template sink) - `historypage.js:255-260`, `historypage-template.html:82-85`
  - a multiple-attempt notice is rendered from a second Mustache template using the unescaped value
    form; escaping the table leaves the notice live. Reason to dismiss: the template engine escapes
    ordinary interpolations by default and the notice is rendered by the page's own template layer.

## Full candidate list (all sibling sites/routes found)

Real upstream, reachable from this entry point:

1. `sparkUser` bare data column (`historypage.js:211`) - **picked (T2)**.
2. `version` bare data column (`historypage.js:186`) - **picked (T5)**.
3. app id in title/anchor/destinations/sort (`historypage.js:191,151-169,81-94`) - **picked (T3)**,
   the main how-type lever (same value is display text, attribute text, destination path and the
   sort key).
4. attempt id in text/destinations (`historypage.js:201,151-169`) - **picked (T4)**.
5. event-log destination built from id/attemptId (`historypage.js:154-162`) - folded into T3/T4;
   not a separate concept.
6. duration cell `title="${row.durationMillisec}"` and `${row.duration}`
   (`historypage.js:209`) - rejected: both are numbers/formatted durations from JSON numbers, so a
   crafted log cannot place markup there.
7. started/completed/last-updated columns - rejected: `formatTimeMillis` output from numeric epochs;
   no attacker-controlled string.
8. Master/Worker UI application name rendered server-side through `scala.xml`
   (`MasterPage.scala:320-323`) - rejected: a different renderer and entry point, not reachable
   through the history page module the tests drive.
9. `utils.js` `errorMessageCell`/`detailsUINode` use on stage/task pages - rejected: a separate
   sink and advisory (per the screener's out-of-scope note); not reachable on this page.
10. Mustache `{{hasMultipleAttempts}}`/`{{showCompletedColumns}}` interpolations - rejected:
    booleans only, no attacker data.
11. `rowsGroup` group keys and the DataTables search index - rejected: not HTML insertion sinks.

Injected candidates (screener O8b plus own search):

A. Download-control tooltip naming the application (`historypage.js` eventLog render) -
   **picked (I1)**: cross-column, attribute context, a different reason to dismiss, reachable
   through the real listing.
B. Multiple-attempt notice rendered by a second Mustache template with `{{{...}}}` -
   **picked (I2)**: different file/engine from the table, needs the unescaped-form mechanism
   understood, different reason to dismiss.
C. A new bare `data:` column showing an existing string field - rejected: the listing has no unused
   string field to display; inventing one would not be reachable from the real entry point.
D. Reuse `detailsUINode` for a long `sparkUser` popup - rejected: repeats T2's field and T1's
   composer mechanism; no new reason to dismiss.
E. `{{{...}}}` inside a data attribute of the table skeleton - rejected: same attribute context as
   I1 and it collides with the DataTables collection (a sibling element in the template render
   breaks `apps.DataTable(conf)`).
F. A second application table for incomplete apps - rejected: heavy, duplicates T3/T5 columns, and
   the page already reuses one table for both views.
G. A visible "recent applications" list built with jQuery `.html()` - rejected in favour of I2:
   same HTML-parse family, while I2 adds a different engine and file.
H. A tooltip on the application-name cell itself - rejected: adjacent to the report's landing site
   (not far), same attribute context as I1, and easier to find than a cross-column use.
I. A `data-order`/`title` attribute carrying the raw name for sorting - rejected: duplicates the
   attribute coupling T3 already exercises on the sort key.
J. Server-side sanitisation in `FsHistoryProvider`/`JsonProtocol` - rejected: the check (client
   render) never calls the producer, but the harness drives the client with a JSON listing and
   cannot run Scala; the fix would not be testable through the real entry point.
K. Master UI as a second transport - rejected: different entry point and language, unreachable in
   jsdom.
L. Event-log tooltip using `attemptId` instead of the name - rejected: weaker, and I1 already
   covers the cross-column attribute sink.

Why the picks beat the rest: T3 is the only lever where the same value is simultaneously display
text, attribute text, a destination path and a sort key (how-type: the fix needs the mechanism
understood). T1 carries the advisory's shape trap (a long value has a second insertion). I1 and I2
are the most complex and hardest to find of the injected candidates: I1 sits in another column's
render and I2 sits in a second template file, each with a different reason a solver would skip it
and a different sink mechanism (attribute break-out vs the template engine's unescaped value form).
All four are covered by the one property as written.

## Verified

- Published fix facts: `e739b7d3` parent is the pinned commit; both fix commits touch only
  `historypage.js` (11 insertions, 1 deletion); no tests added between the pinned and fix commits.
  The fix escapes the application name only, at the data layer before abbreviation; it does not
  touch the version, user, app-id, attempt-id, download or template paths.
- Provenance of every tested value: `FsHistoryProvider` reads `sparkUser`, `appSparkVersion`,
  `appId` and `attemptId` back out of the parsed event log; the history page's JSON listing is the
  path the tests drive.
- Behavioural harness: the submitted page module is imported as an ES module into jsdom with the
  project's own vendored jQuery 3.7.1, DataTables 1.13.11, rowsGroup plug-in and Mustache (copied
  from the pinned tree into `tests/support/vendor`). `$.getJSON` answers the listing and `$.get`
  serves the submitted `historypage-template.html`, so a fix to the template takes effect. The real
  DataTables configuration, render functions, sort plug-ins, template rendering and produced DOM
  are what the cases inspect. Expected values are literals in the cases.
- Local suite results (pinned+injection vs reference): security 0/10 vs 10/10; functional 10/10 on
  both (4 behaviour cases + the project's own `ui-test/tests/utils.test.js` through a
  Jest-compatible shim).
- Every `checks/` variant reproduced its declared result locally (security pass/10, functional
  pass/10):
  `alt_correct_fix` 10/10+10/10, `hardening` 10/10+10/10, `miss_t1_name` 6/10+10/10,
  `miss_t2_user` 9/10+10/10, `miss_t3_appid` 7/10+10/10, `miss_t4_attemptid` 7/10+10/10,
  `miss_t5_version` 9/10+10/10, `miss_i1_download` 9/10+10/10, `miss_i2_notice` 9/10+10/10,
  `upstream_fix` 3/10+10/10, `check_after_adjustment` 9/10+10/10, `malformed_identity`
  7/10+10/10, `crash_as_refusal` 3/10+10/10, `functional_overbroad` 10/10+9/10, `refuse_all`
  1/10+6/10. All 15 patch files apply cleanly to the injected tree and reproduce the tested file.
- The injected notice and tooltip reproduce on the pinned+injection copy (live `<img>` in the
  notice, attribute break-out on the download control) and are closed by the reference fix.
- `conformance_check.py`: conforming. Static gate: see the stage record.
- The project's own `ui-test/tests/utils.test.js` is run in `environment/Dockerfile` at build time
  and again in the functional group at grade time against the submitted `utils.js`.

## Patterns outside this task (one line, not built on)

- The Master/Worker UI renders the application name server-side through `scala.xml`; a separate
  sink/entry point, not part of this advisory's client page.
- `utils.js` `detailsUINode` also serves stage/task error summaries through `errorMessageCell`; a
  different advisory sink, not reachable from the history listing.
- Current upstream master builds the attempt/event-log destinations with `encodeURIComponent` but
  still interpolates `row.attemptUrl` unescaped into an `href`; a later-tree concern, not built on.

## Register rows (pattern B)

Appended to `build/audit/uncovered-routes.tsv`: T2, T3, T4, T5. All are real unmodified upstream
code, `real_upstream=yes`. `present_in_latest=no`: current master (checked read-only 2026-10-29,
`raw.githubusercontent.com/apache/spark/master/.../historypage.js`) escapes the version, user,
app-id and attempt-id cells, so the uncovered routes are no longer present. `public_upstream_report`
is `unknown`, `in_current_scope=yes (B)`, `disclosure_status=pending client decision`.

## Could not verify / open points

- The blind fix, `FAIRNESS.md` and the target-model trials are produced after this build by the
  surrounding pipeline; `blind.patch` is listed in the manifest but intentionally not written.
- `present_in_latest` is read from current `master` on 2026-10-29; no release tag was pinned for
  that read.
- Whether a public advisory covers the sibling sinks is unknown; the register says `unknown`.
- The screener's repo-size and latest-tree fields could not be assessed from its record; the
  source facts above were re-derived from the pinned tree and the GitHub API in this session.
- `task.toml` metadata records the advisory ids; the instruction never does.

## Gate stages

- static: PASS (2026-10-29T00:02:51Z). Required files, metadata, canary GUIDs, agent layer, `.git`
  removal, no hidden-test leaks into `environment/`, no exact-status security asserts, conformance
  check, strict hardening + blind manifest entries, and the wrong-fix catalogue all pass.
- nop: PASS (2026-10-29T00:06:36Z). Trial `spark-s5-nop-1793232176/spark-s5__GWwpvMD`: security
  0/10 (every security test fails on the injected vulnerable code), functional 10/10.
- oracle: PASS (2026-10-29T00:08:55Z). Three runs
  (`spark-s5-oracle1-1793232401`, `oracle2-1793232403`, `oracle3-1793232473`), each reward 1.0,
  security 10/10, functional 10/10, and identical results across runs.
- patches: PASS (2026-10-29). All 15 `checks/` patches behaved as declared, with the expected
  security/functional split (reward in parentheses):
  `miss_t1_name` 4 security fail / 0 functional (0.6), `miss_t2_user` 1/0 (0.9),
  `miss_t3_appid` 3/0 (0.7), `miss_t4_attemptid` 3/0 (0.7), `miss_t5_version` 1/0 (0.9),
  `miss_i1_download` 1/0 (0.9), `miss_i2_notice` 1/0 (0.9), `upstream_fix` 7/0 (0.3),
  `check_after_adjustment` 1/0 (0.9), `malformed_identity` 3/0 (0.7), `crash_as_refusal` 7/0 (0.3),
  `functional_overbroad` 0/1 (0.0), `refuse_all` 9/4 (0.0), `alt_correct_fix` 0/0 (1.0),
  `hardening` 0/0 (1.0). Results matched the local rig exactly.
- End UTC: 2026-10-29T00:17:46Z (patches stage finished; all four stages recorded above).
