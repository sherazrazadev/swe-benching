# oh-my-posh-s4 — build notes

- Start (UTC): 2026-10-30T00:04:23Z (pipeline.log)
- End (UTC): 2026-10-30T00:47:00Z
- Candidate: jandedobbeleer/oh-my-posh @ 7ec9fb8eb0f091354795eca7b024332a59e6614f (fix 88ddbe0b)
- Track: injected. Pattern: A. Advisory family: template injection (CWE-1336) to OS command execution (CWE-94).

## Security property (written once, before choosing routes)

Text the product did not take verbatim from the user's theme must never run a
program, read a file, or otherwise reach the host through the template helpers —
no matter where the text came from, how it was supplied, or what unrelated theme
text it happens to match. Only theme-authored expressions may use those helpers.
A refused value does not abort the prompt.

The report (instruction.md) states exactly this. It never names a site, a route
or a mechanism.

## Levers (one line each)

1. T1 path sink — how-type base: the displayed path is composed from raw folder
   names and re-rendered with the full helper set (src/segments/path.go:285);
   only reported site, obvious once the report is read.
2. T2 parse-cache trust — how-type (producer off the check's path): the parsed
   template cache binds the helper set at parse time and its key has no trust
   level, so identical text parsed earlier as theme text lends cmd/readFile to a
   later runtime-composed render (src/template/render.go:55-103). Reason to
   dismiss: a cache keyed by text looks like a pure parser optimisation.
3. T3 pooled render object — how-type (state across renders): a reusable Text
   object keeps the trust mark of an earlier render, so a later runtime-composed
   render gets the full helper set (src/template/text.go:19-47). Reason to
   dismiss: each render appears to get a fresh object.
4. T4 repository text — injected sibling: a branch name is re-rendered after
   branch mapping (src/segments/scm.go:161-164). Reason to dismiss: repository
   metadata reads as local data and the branch template is theme text.
5. T5 resolved value — injected sibling: a segment resolves its url option and
   renders the resolved text again, so an environment-derived value executes
   (src/segments/http.go:35-41). Reason to dismiss: the option is theme text and
   the first pass already succeeded.

Coupled must-keep-working behaviour (functional tests): theme-authored
templates (segment templates, separator option) keep cmd/readFile/env; a
mapped-location key and a mapped-location value written in the theme keep
resolving through the display re-render; text that only looks like a template
but cannot be parsed is still shown verbatim, not stripped or escaped away;
ordinary paths and git/http segments keep working.

## Sibling candidate list (all found, then narrowed)

Searched every non-test `template.Render` call site and every producer of text
that reaches one.

Real upstream candidates (all config-authored at the pinned commit; no runtime
data reaches them, so none is a security route):
- src/color/colors.go:163, src/color/palette.go:40 (palette/color values)
- src/config/config.go:101 (palettes.template), src/config/segment.go:30/304/583
  (segment style, fallback template, segment template)
- src/prompt/engine.go:120/184/205, src/prompt/extra.go:60/195 (pwd, filler,
  console title, extra prompts)
- src/segments/language.go:361 (version_url_template; the version is
  regex-extracted digits, so template syntax cannot survive into it)
- src/segments/options/map.go:108 (option values; every caller passes a config
  option, not a runtime value)
- src/segments/scm.go:171 (branch_template is config), src/segments/status.go:51/90
  (status template is config; malformed pipe status is written literally)
- src/segments/http.go:35 (url option is config)
- src/template/list.go:45/62 (template lists are config)
- src/segments/path.go:296/323/655 (max_width, separator, mapped keys are config)
Injected-only candidates considered: an options.Map.Template call on a
runtime-refreshed option (would need a network/OAuth data source), a status
pipe-status substitution (would be split on spaces before the render and the
raw code is written literally), and the language version substitution (version
is regex-extracted; not reachable). Those were dropped as not realistically
reachable. T4 (repository text) and T5 (resolved value) were picked because both
are reachable through the real prompt command, both are code a maintainer could
plausibly write in the same "resolve the composed text again" style as the
reported sink, neither sits in a file region the published fix changes (the fix
changes a neighbouring call's name, not these lines), and each has a different
reason to dismiss. T2/T3 were picked over a further sibling because they are the
two how-type mechanisms the published fix itself had to handle (cache key trust
bit, per-render flag reset) and they are testable through the same real command
without extra services.

## Gate results (run in order; then a final full end-to-end run)

- FULL RUN: PASSED (build/oh-my-posh-s4/gate_report.json; verdict pass, all
  four stages ok, all 11 patch checks ok).

- static: PASSED (final files).
- nop: PASSED - 8 security tests fail on the pinned+injected tree, 166 functional
  tests pass (10 hidden + 156 restored project tests).
- oracle: PASSED - 3 runs, each reward 1.0 with identical results (174/174).
- patches: PASSED - 11 declared checks:
  sec_miss_base 0.25 (6 security fail), sec_miss_cache 0.875 (1),
  sec_miss_pool 0.625 (3), sec_miss_repo 0.875 (1), sec_miss_http 0.875 (1),
  sec_miss_read 0.875 (1), crash 0.0 (8 security fail, functional all pass),
  refuse_all 0.0 (4 functional fail), strip_markers 0.0 (2 functional fail),
  hardening 1.0, alt_pass 1.0. The blind patch is generated later by the
  pipeline machinery and was not written by the builder.

## What was verified

- The flaw reproduces end to end at the pinned commit through the built CLI:
  a directory named `{{ cmd "touch" "PWNED" }}` creates PWNED; readFile leaks a
  file; the shell-supplied directory channel and the folder style both execute.
- The published fix (source-only) blocks all of those; our reference fix is the
  published source fix plus the two sibling fixes, and it also blocks them.
- Eleven builds were run locally: reference fix, both template-core wrong fixes
  (cache blind, pooled flag), the two sibling misses, a reads-only miss, a crash
  refusal, a global removal (functional fail), a marker-stripping over-broad fix
  (functional fail on the coupled mapped-value and verbatim-text tests), a
  defensive-hardening variant and an independent compatibility-preserving fix
  (keeps the old render entry point trusted and adds a restricted one). Each was
  built and driven by the hidden suites; results match the manifest declarations
  exactly (8 security tests / 10 functional tests; restored project suites
  config+color+prompt pass on every variant).
- Every wrong-fix patch was applied to a fresh copy of the pinned+injected tree
  with `patch -p1`, rebuilt and re-run, not just built from a pre-made tree.
- Project tests at pinned+injected: config, color, prompt, and the path tests
  TestFullAndFolderPath, TestFullPathCustomMappedLocations, TestParent,
  TestFolderPathCustomMappedLocations, TestReplaceMappedLocations all pass.
- Determinism: the pool-leak scenario created the marker 40/40 times on the
  pooled-flag miss and 0/40 on the cache miss; the hidden suites are black-box
  (stdlib only, one CLI process per test), so no shared state between tests.
- No network is needed at test time: the http sibling test targets 127.0.0.1:1
  (connection refused) and the functional http test uses an in-process
  httptest server on loopback. git is installed in both images.

## Deliberate choices / deviations

- The reference fix is the published source diff (16 files, tests excluded) plus
  the two sibling fixes. The published fix renames template.Render everywhere;
  our fix patch keeps that published shape (Render removed). A second valid
  design that keeps the old entry point trusted is the alt_pass patch.
- The graded functional project suite is config+color+prompt, restored from
  pinned copies in tests/pristine so edits in /workspace cannot weaken it, but
  not src/segments:
  the pinned path test files call the internal render function the published fix
  renames, so running them would reject the published design. The pinned path
  tests are run in the image build (where the pinned tree still has that
  function), satisfying "the project's own tests for the affected area pass in
  the image at the pinned commit".
- No Pattern B register rows: the extra routes are injected siblings, not
  unmodified upstream routes.

## What could not be verified

- The full GHSA/CVE text was not available; the advisory summary supplied with
  the task was the only wording of the protected property.
- The published fix commit could be read but upstream's later history was not
  inspected beyond it.
- The environment and verifier images were not built at the time of writing;
  the gate stages do that (Docker build offline behaviour is assumed from the
  warmed module/build caches).
- `repo_mb` was not measured.
