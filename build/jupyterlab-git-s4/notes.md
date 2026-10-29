# jupyterlab-git-s4 — build notes

- Start (UTC): 2026-10-29T11:43:40Z
- End (UTC): 2026-10-29T12:39:12Z

## Gate

- static: PASSED.
- nop: PASSED — 10 security tests fail on the untouched vulnerable code, 14 functional tests pass.
- oracle: PASSED — 3 runs, each reward 1.0, 24/24, identical results.
- patches: PASSED — every check behaved as declared:
  sf-no-headers 0.6 (4 security fail, 0 functional fail), sf-labels-only 0.4 (6/0),
  sf-no-error-banners 0.6 (4/0), sf-no-toolbar-caption 0.9 (1/0),
  sf-no-image-caption 0.9 (1/0), ff-blanket-text 0.0 (4/9),
  ff-refuse-all 0.0 (10/4), alt-escape-html 1.0, harden-dom-helper 1.0.
- The `blind` patch is not written here; the pipeline writes it after the trial.
- Repo: jupyterlab/jupyterlab-git, pinned af267598e7437993c02a14101db41c75809a7f88,
  published fix c6d37b88f36aa59aee317930b95e427fb9d6b09b (a single child commit; source part is
  two banner builders).
- Scratch clone: `~/.tb-graders/cwe/work/jupyterlab-git-s4/src-repo` (pinned tree + injection
  commit 36a1692 + node_modules). Nothing was committed to the source repository.

## The security property (written once, before the routes were chosen)

No value that the extension obtains from the repository or the git server (revision names, commit
identifiers, file paths, or the text returned with a failed request) may be interpreted as page
markup by a comparison view. Every such value must appear as the literal characters it contains; it
must not add, change or remove elements or attributes, and must not run as script. This holds
however the value arrives and wherever a comparison view shows it.

Every route and every injected sibling falls under this sentence; the report does not name any of
them.

## Levers (one line each)

- T1 — reported route (where): the two published header builders interpolate the revision labels
  into an HTML string; PlainTextDiff.ts:219-226 and NotebookDiff.ts:400-413.
- T2 — main lever, how-type: the three failure notices interpolate the server message into an HTML
  string and had no protection in any release; PlainTextDiff.ts:288-296,
  NotebookDiff.ts:369-375, ImageDiff.tsx:513-519. Coupled must-keep-working: the notice turns
  newlines into line breaks, so a plain text-content rewrite changes behaviour.
- T3 — injected sibling, how-type shape: a revision caption in the notebook toolbar builds
  `title="${escapeHtml(label)}"` where the helper escapes `& < >` but not `"`, so escaping the
  element text is not enough; NotebookDiff.ts:107-116. Reason to skip: it is toolbar chrome, it
  passes through an escaping helper, and the `&rarr;` entity makes it look intentionally HTML.
- T4 — injected sibling, where: the image provider builds a file-path caption from an HTML string
  beside its React-rendered labels; ImageDiff.tsx:420-424. Reason to skip: "that provider uses
  React, so it is safe".

## Sites and routes the hidden security tests cover

7 sites / 7 route groups: plain-text header (normal, merge, composed relocation label), notebook
header, the three failure notices (Error and non-Error rejections), the notebook toolbar caption
(attribute breakout), the image path caption. 10 security tests, 14 functional tests.

## Full candidate list of sibling sites/routes, and why the picks won

Real upstream HTML sinks found by searching `src/` for `innerHTML`/`dangerouslySetInnerHTML`/
`insertAdjacentHTML`:

1. `PlainTextDiff.createHeader` — published fix; kept as T1.
2. `NotebookDiff.Private.diffHeader` — published fix; kept as T1.
3. `PlainTextDiff.showError` — real, unmodified, still present in the current release; picked
   (T2).
4. `NotebookDiff.showError` — same; picked (T2).
5. `ImageDiff.showError` — same; picked (T2).
6. `AdvancedPushForm.tsx:78` `innerHTML = ''` — clearing before rebuilding a select; no
   repository value is parsed. Rejected: not a sink.

Screener O8b leads:

7. ImageDiff labels in a DOM banner — rejected: the provider already renders the same two labels
   with React; duplicating them as a DOM banner is not code a maintainer would leave.
8. FilePath search-highlight with markup — rejected: that component is the file list, not a
   comparison view; it is outside this advisory's entry point and the property is written over
   comparison views.
9. The widget id built from raw labels in commandsAndMenu — rejected: the id is set through the DOM
   property and never parsed as HTML; no sink.

My own search:

10. The notebook factory's toolbar (the project already adds items there) — picked as T3.
11. The image provider's own caption area — picked as T4.
12. A file-path caption inside PlainTextDiff — rejected: same file and adjacent function as the
    landing point, so it is short distance and adds little.
13. The notebook "Hide unchanged cells" item — it already uses `textContent`; making it a sink
    would be a second toolbar sibling of the same concept as T3.
14. `commandsAndMenu` catch → `modelIsLoading.reject(msg)` — rejected: the message is consumed by a
    MainAreaWidget reveal promise, not an HTML sink.
15. `notifications.tsx showError` — React `<pre>`, safe. Rejected.
16. `CommitDiff`, `HistorySideBar`, `PastCommitNode`, `BranchMenu`, `TagMenu` — React text
    rendering, safe; also outside the comparison entry point.
17. nbdime rendering of notebook cell content — third-party rendering of content, not of the
    labels the property protects. Rejected.
18. The tab title/caption in `gitShowDiff` — Lumino `Title`, text only. Rejected.
19. `PreviewMainAreaWidget` — no repository value reaches it. Rejected.

Why the picks: T2 is the only how-type lever that is real and still open in the latest release, and
it carries a coupled behaviour. T3 is the hardest how-type shape (attribute context behind a
helper that looks like the fix). T4 is the furthest real-looking display path (separate provider
and file, different data kind) with its own reason to skip. Together they give three different
reasons to dismiss: "error handling, not labels", "toolbar chrome, and it is escaped", and "that
provider uses React".

## What I verified

- Shallow fetch of the pinned commit works; `git log` between pinned and fix shows the fix adds
  only the two banner builders plus their regression specs — the pinned tree contains no
  regression test for the advisory.
- The project's own jest specs for the area pass at the pinned commit (node_modules installed with
  the project's yarn 3.5.0; jest 29.7.0, ts-jest): 4/4.
- Every security test fails on the pinned+injected tree and passes on the oracle; every functional
  test passes on both. Verified in a staged workspace that mirrors test.sh (10 security / 14
  functional), and each check patch was run the same way.
- Every check patch applies to the injected tree and behaves as declared:
  sf-no-headers (4 sec fail), sf-labels-only (6 sec fail), sf-no-error-banners (4 sec fail),
  sf-no-toolbar-caption (1 sec fail), sf-no-image-caption (1 sec fail), ff-blanket-text (9 fun
  fail), ff-refuse-all (4 fun fail), alt-escape-html (10/14 pass), harden-dom-helper (10/14 pass).
- git ref names may contain `<`, `>`, `&` and `"` (checked with `git check-ref-format`), and a
  repository file name may contain `<`, `>` and `&` without git quoting it (checked with
  `git status --porcelain`), so the attack values reach the views unmodified.
- The three failure notices still build from an HTML string in the current upstream release
  (0.55.0), so `present_in_latest = yes`.

## What I could not verify

- Whether a real backend failure always embeds the repository-controlled file name or ref in the
  message that reaches the failure notice. The route is real (the backend raises with git's stderr,
  which echoes the ref/path), but I did not execute a full JupyterLab server against a hostile
  repository; the hidden test drives the widget with a rejected content promise, which is the same
  value shape the client receives.
- Behaviour in a real browser for the attribute payload: jsdom parses the attribute but never
  fires events; the test asserts the DOM shape (no injected attribute), not execution.
- Two target models' behaviour: not run here by instruction.

## Fairness notes

- The report states the property over the protected data and does not name a route. A blind
  engineer can find every sink with a search of the comparison components for HTML-string writes.
- The functional side accepts any correct rendering design: the header test requires one child
  element per side (not a specific tag), the multi-line test accepts a `<br>`, a preserved newline
  or block children.
- The failure-notice functional tests only use ordinary messages, so they pass on the vulnerable
  build (the nop requirement).
