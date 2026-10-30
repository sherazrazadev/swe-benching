# Build notes — yard-s4

- Start (UTC): 2026-10-29T12:54:23Z (pipeline start; this builder session began 13:02Z)
- End (UTC): 2026-10-29T13:19Z (gate stages finished; blind fix and trials downstream)

## Task
lsegal/yard, GHSA-PXCC-8665-PHX8 / CVE-2026-49342 (CWE-22): the static cache
trusts raw request paths for both the disk read (`StaticCaching#check_static_cache`,
keyed on `request.path`) and the independent disk write (`Commands::Base#cache`,
keyed on `request.path_info`), so a request path can read or write a page file
outside `--docroot`. Pinned d29a77cd; published fix f78c19f0. Track: injected.
Shipped `/app` equivalent (`/workspace`) = pinned commit + `injection.patch`
(two same-class siblings). Oracle = published source changes + fixes for both
siblings.

## Design levers (each with a different reason to dismiss)

- **L1 (main, how-type; producer off the read check's path).** `Commands::Base#cache`
  (`lib/yard/server/commands/base.rb:165-174`) is a second implementation of the
  document-root path rule and the *producer* of what `check_static_cache` later
  reads; the read check never calls it. `Base#call` visibly runs `File.cleanpath`
  on `path`, so the writer looks sanitised, and the advisory reads as a read bug.
  Security: a rendering route whose raw `request.path_info` carries upward
  segments writes the page above the root. Shape trap in the same sink: the root
  request `/` writes to `<docroot>.html` (leading-slash join), which a `..`-only
  check misses.
- **L2 (injected sibling S1, how-type; shape a plausible check mishandles).**
  New cache-purge route/command removes a caller-named cached page; its containment
  test is `expand_path(rel, root).start_with?(root)`, which accepts a sibling
  directory whose name shares the root's prefix. Dismiss: "it already validates
  containment."
- **L3 (injected sibling S2, how-type; shape a plausible check mishandles).**
  New cached-page preview/download route/command; its guard rejects `..` path
  segments, but the value is resolved with `File.expand_path(rel, root)`, so a
  residual absolute path (produced by a doubled slash after the route prefix)
  resets to the filesystem root and is read. Dismiss: "it rejects upward
  segments and resolves relative to the root."

## Sites / routes / input shapes covered by the security tests
- Read sink: HTTP GET with `..` segment, outside page returned (real).
- Write sink via a rendering route: `..` segments in `request.path_info`, page
  written above the root (real, producer).
- Write sink via the index route `/`: page written to `<docroot>.html` (real
  shape; leading-slash join).
- Purge route: sibling directory sharing the root prefix (injected S1).
- Preview route: absolute residual path via a doubled slash (injected S2).

## Coupled must-keep-working (functional)
- Cached page served from the root with and without the `.html` suffix.
- Mount prefix (`script_name`) remains part of the lookup location.
- A page name that merely contains `..` as a substring still resolves.
- A rendered page is cached inside the root and served from that cache on the
  next request.
- Purge still removes an in-root cached page; preview still serves an in-root
  cached page.
- A static asset under the root is still served; library extra files unchanged.
- The project's own server specs for the area, restored pristine.

## Full candidate list (screener O8/O8b + own search)
1. `lib/yard/server/commands/static_file_helpers.rb:47-49` — document_root join in
   `find_file`, reached by `/static/...` and by the `RootRequestCommand` fallback.
   Real, unmodified upstream. **Not built:** on Linux the router/command path has
   already been through YARD's `File.cleanpath`, which drops leading `..`
   segments (verified: `cleanpath('../../a') == 'a'`); the residual escape needs
   `\` separators, which are a literal filename character on Linux. The
   screener's own note said Windows-only; confirmed and dismissed (register row).
2. `lib/yard/templates/template.rb:112` (`find_nth_file`) — template-root join
   used as `find_file`'s fallback. Same cleaned-URL limitation; also a different
   root (template assets are served from the YARD install, not the docroot).
   Not built.
3. `lib/yard/server/commands/display_file_command.rb:12` — `library.source_path`
   join, a different configured root (library source, legitimate outside the
   docroot). Out of this advisory's scope. Not built.
4. `lib/yard/server/commands/library_command.rb:132` / `library_version.rb:210` —
   `Dir.chdir(library.source_path)` from server configuration, not request input.
   Not a route.
5. `lib/yard/templates/engine.rb:165` — template path join from a template name,
   not the docroot. Not a route.
6. Injected **S1** purge route (chosen). Most complex/hardest of the candidates
   because the containment check exists and is wrong only in its boundary
   comparison; far from the report (a separate route and command, a different
   operation: removal), plausible reason to dismiss.
7. Injected **S2** preview route (chosen). The value is resolved against the
   root and the reported `..` shape is rejected, so the remaining absolute-path
   reset is easy to overlook; separate route/command, a read operation that looks
   covered by the report's own fix.
8. Injected asset route reusing `find_file` with a single-pass `gsub('../','')`
   (candidate, not picked): a sanitizer-bypass shape, but it overlaps candidate
   1's shared helper and adds a third read variant; kept out to keep the task
   within the fairness budget.

Why S1/S2 beat the others: both are how-type (the fix needs the boundary
mechanism understood), both sit on their own routes far from the static-cache
report, and their code looks guarded, while the real upstream candidates are not
reachable on the benchmark's Linux host.

## Verification (local, offline, no model/network)
- Every security case reproduced through `YARD::Server::RackAdapter#call` with a
  `Rack::MockRequest` env at the pinned+injected tree (5/5 security examples fail)
  and is refused after the oracle (5/5 pass); the two-dot, mount-prefix,
  cached-page round trip, in-root purge/preview, static asset and index
  functional examples all pass on both trees.
- The project's own restored area specs (static_caching, base, router, adapter,
  rack_adapter: 39 examples) pass on the pinned+injected tree, the oracle, and
  both pass-variant patches.
- The verifier was run as the shipped separate image against a mounted
  /workspace: pinned+injected gives reward 0.0 with exactly the 5 security
  examples failing, oracle gives reward 1.0 (54/54).
- All check patches behave as declared locally:
  sf_miss_read / sf_miss_write / sf_miss_root / sf_miss_purge / sf_miss_preview /
  sf_crash / sf_read_only / sf_writer_only -> security_fail with all functional
  passing; ff_overbroad and ff_refuse_all -> functional_fail; pass_alternative
  and pass_hardening -> all tests pass.

## Gate
- static: PASS (after the CLEAN_ENV gem-path fix; blind.patch is the only missing
  check patch, left for the downstream blind-fix run).
- nop: PASS (5/5 security examples fail, all functional and project examples pass,
  reward 0.0).
- oracle: PASS (3/3 runs reward 1.0, identical results).
- patches: PASS 12/12 (8 security_fail, 2 functional_fail, 2 pass incl. hardening); all as declared.

## Could not verify / guesses
- `present_in_latest` for the two real upstream routes was not re-checked against
  current upstream (the screener said "unknown"); recorded as unknown in the
  register.
- Repo size in MB was not measured (it fits comfortably in the image; no size
  threshold issue arose).
- The O8 `find_file` escape was confirmed to be Windows-only on this host
  (YARD's `File.cleanpath` drops leading `..` on POSIX); whether a Windows
  deployment reaches it was not exercised (the task's tests run on Linux).
- Whether WEBrick's front-end normalises `..` before the router was not tested;
  the Rack adapter (the entry point the tests drive) preserves it.
- The blind fix has not been written (left to the downstream run), so whether a
  blind engineer finds every sibling is not yet known.

## Scope notes (one line each)
- `DisplayFileCommand` joins `library.source_path` (a different configured root),
  outside this advisory's protection; not built.
- The pinned tree already carries the earlier router-side cleanpath defence
  (GHSA-xfhh-rx56-rxcr); not re-audited beyond the document-root sinks.


