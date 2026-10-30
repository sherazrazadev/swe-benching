# hono-s4 build notes

Start (UTC): 2026-10-30T05:13:51Z (from build/hono-s4/start_utc.txt)
End (UTC): 2026-10-30T05:43:11Z

Advisory: GHSA-GQVV-2MRQ-WPJV / CVE-2026-84365, honojs/hono, path traversal (CWE-22) in
static-site file writes. Pinned 9c28d724c5a7fb086ebaa812fdc1ad6e957c63bc (= sole parent of the
published fix 3a67f7f3997e1437d108f7bcba2dbcee2df69221). Track: injected, pattern A.

## Plan (written before building)

### Security property (one, in the report)

No file the static-site generator produces may be created, changed or removed outside the output
directory it was given. This holds for every value other than the output directory itself that the
application or its content supplies to name a produced file or choose its location, and however
that value reaches the generator. A refused generation reports failure (throw or unsuccessful
result) and leaves nothing outside the output directory changed.

The property is over the produced outcome, not over a route or field, so every lever below falls
under it literally and the report names none of them.

### Levers and why each is dismissed

- **Main lever T4 (how-type: the boundary check runs before an adjustment).** A response may name
  the file it is written to; the name is joined and used *after* the page path was validated.
  Dismissal: "the check already ran on the page, and the response supplies its own name."
  where: src/helper/ssg/ssg.ts:322 and 378-381 (injected).
- **T1 (how-type: a shape a plausible check mishandles).** The reported flaw: a run of parent
  segments is collapsed only partially by the path producer, so the string-prefix guard still
  matches while the path resolves outside. Dismissal: "the guard is visibly a prefix test; tighten
  that comparison." where: utils.ts:20-26,50-55,77-87; ssg.ts:56-78 (published).
- **T3 (how-type: a producer off the check's path).** Redirect pages are materialised from the
  response target after the generation stage; the page path was checked, the redirect path is
  composed by a separate writer. Dismissal: "auxiliary redirect output, not a page address."
  where: redirects.ts:16-28, reached from ssg.ts:295,375 (injected).
- **T2 (route where the protection never existed).** The output manifest is written by a separate
  writer with no boundary check at all. Dismissal: "build metadata rather than page output, and
  the name is caller configuration." where: manifest.ts:14-28, called at ssg.ts:525 (injected).
- **T0 (where-type extra: lower-level public API).** The exported one-page writer is the same
  sink; a fix applied only at the whole-site entry point leaves it open. Dismissal: "same code
  path; the example covers it." where: ssg.ts:353 (published site).

Different reasons to skip: post-check timing (T4), prefix-test plausibility (T1), auxiliary
content-driven output (T3), trusted side artifact (T2), wrong fix layer (T0).

### Sites, routes, input shapes covered by the security tests

- sites: generateFilePath / saveContentToFile / writeOutputManifest / writeRedirectFile /
  the response-name branch.
- routes: whole-site generation through toSSG, and one-page-at-a-time through the exported
  saveContentToFile (real entry points; no disk, no network).
- shapes: a plain parameter run, a run ending in the file extension, a run ending in a separator,
  a longer run, a run under an absolute output directory, a relative-parent redirect target, and
  names supplied directly to the per-page writer.

### Coupled must-keep-working behaviour (functional tests)

Nested routes and subdirectories; an in-directory parent segment; absolute, parent and grandparent
output directories; redundant leading separators; a Windows-style root; the per-page writer;
legitimate manifest names (default and nested); a legitimate redirect target; a legitimate
response-chosen name. The over-broad patch (reject any parent segment in the output directory)
fails two of these.

### Candidate sibling sites and routes, and why the picks won

Real upstream candidates found by searching every write/join site:

1. saveContentToFile (exported one-page writer) - published site, chosen as T0.
2. generateFilePath - the only guard call on a page path; part of T1.
3. joinPaths/handleParent - the producer; part of T1.
4. ensureWithinOutDir - the guard; part of T1.
5. dirname - pure string helper, no sink; not a lever.
6. bun adapter FileSystemModule - delegates to the base generator; no path logic; rejected.
7. deno adapter FileSystemModule - same; rejected.
8. redirectPlugin - builds response HTML only at the pinned commit, writes nothing; not a route.
9. defaultPlugin - status filter only.
10. afterGenerateHook - caller-owned callback, not product code.
11. fetchRoutesContent / replaceUrlParam - produce routePath but never write; the fix belongs at
    the sink, so no separate lever.
12. extensionMap - only chooses the extension, then feeds the same guard; no separate sink.

Injected candidates (screener O8b plus own search), and the decision:

13. output manifest (a second, unguarded side-artifact writer) - CHOSEN T2.
14. redirect-page writer (a second save helper) - CHOSEN T3.
15. response-chosen output name applied after the guard (post-check adjustment) - CHOSEN T4.
16. notFound page writer - rejected: needs extra probing/request plumbing to render a 404, and it
    is the same unguarded-side-artifact mechanism as T2.
17. clean/stale-output removal - rejected: needs readdir/remove added to the FileSystemModule
    interface, changing every adapter and every existing mock; no clean path-confinement story.
18. directory-style ("pretty URL") layout option - rejected: it composes inside generateFilePath,
    so the existing guard already covers it; making it a gap would be contrived.
19. sitemap writer - rejected: same mechanism as the manifest (side artifact, caller name).
20. localized output subdirectory from a Content-Language value - rejected: same post-check
    adjustment mechanism as T4; two levers of one concept.
21. third platform adapter - rejected: all adapters delegate to the base generator, so there is no
    path logic to leave unguarded without inventing an adapter that rewrites paths.
22. plugin-based writer - rejected: plugins have no filesystem access; afterGenerateHook sees no
    response data.

The three picks are the hardest of the candidates (two are separate modules from the landing, one
is a timing hole inside the sink), all are reachable through the real entry point, all fall under
the one property, and none is touched by the published fix. Each has a different reason to skip.

## What was verified

- The flaw reproduces at the pinned commit through the real entry points (local scripts against
  the checkout): toSSG and saveContentToFile report success while the recorded write path resolves
  outside the output directory. The three injected features reproduce the same way.
- The oracle (published source fix reduced to source changes plus guards in every injected writer)
  closes all of them: local suites nop security 0/15 pass (all 15 fail on vulnerable code),
  functional 71/71 pass; oracle security 15/15, functional 71/71.
- Every check patch behaved as declared locally (see manifest.patch_checks):
  published_fix_only 6/15 security, functional 71/71; no_joinpaths 6/15 security, 71/71;
  no_manifest 12/15, 71/71; no_redirect 12/15, 71/71; no_override 12/15, 71/71;
  route_guard 12/15, 71/71; tossg_only 14/15 (only the per-page testcase fails), 71/71;
  overbroad 69/71 functional; refuse_all 28/71 functional; hardening 15/15 + 71/71;
  alt 15/15 + 71/71.
- The project's own SSG tests (59 testcases) pass at the pinned commit with the injection and with
  the oracle; the functional group runs pristine copies restored at grade time.
- injection.patch and fix.patch apply cleanly to a fresh pinned checkout with `patch -p1`.
- The pinned commit is the sole parent of the fix commit; the fix's added regression tests are not
  present at the pinned commit and are not shipped in the image.
- No network, disk, GPU or service is needed at test time: the suites run the app in-process with
  a recording FileSystemModule; dependency installation happens only while images are built.

## What could not be verified

- Target-model outcomes: trials are run downstream; this build did not run any.
- The GHSA/CVE text itself was not read; the mechanism was reconstructed from the fix diff and the
  pinned code, as the screener also reported.
- Whether the repository is below the tiny-repo size line (the screener's unknown). A source export
  of the pinned tree is well under 5 MB excluding node_modules.
- present_in_latest for the injected siblings: they are not upstream; the published fix is present
  in current upstream code (read-only check of `main`).

## Gate results (Harbor, offline)

- static: PASS.
- nop: PASS - security 15 testcases, all 15 fail on the vulnerable code; functional 71/71 pass.
- oracle: PASS - 3 runs, reward 1.0 each, identical results.
- patches: PASS - 11/11 declared checks behaved as declared:
  published_fix_only 0.4, no_joinpaths 0.4, no_manifest 0.8, no_redirect 0.8, no_override 0.8,
  route_guard 0.8, tossg_only 0.9333 (security_fail); overbroad 0.0, refuse_all 0.0
  (functional_fail); hardening 1.0, alt 1.0 (pass). The blind patch is declared but not built
  here (written downstream), as the build prompt allows.

The security tests assert the invariant directly (no recorded create/write resolves outside the
output directory, and every reported output path is inside it); they do not demand a particular
refusal, so a fix that neutralises a malicious value instead of rejecting it still passes, while a
refusal that leaves a side effect behind is caught.

## Fairness notes

- The injected writers take values supplied by the caller, the response or the application; the
  report's property is over any supplied value that decides a produced file's location, so none of
  them needs a new contract the solver must invent. All option and header names are visible in the
  pinned code.
- The Windows-root functional case is required by the published fix's own regression suite; the
  report names Windows-style roots as must-keep-working so an alternative fix can see it.
- A "prefix-only" fix is not enough, and a blanket parent-segment rejection breaks a supported
  output directory; both are represented by patches.

## Scope

Nothing outside the advisory's own protection was built on. The project's own SSG tests for the
area are the only project tests run.
