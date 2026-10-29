# langroid-s4 — build notes

- Start (UTC): 2026-10-29T00:47:06Z
- End (UTC): 2026-10-29T01:25:49Z
- Repo: langroid/langroid
- Pinned (vulnerable): fee670d502ed6d82b8414388bd137a315830331f
- Published fix: 56e2756ecab70a70a7e6edbee2f2187b8484683e
- Advisory: GHSA-FG23-3346-88F5 / CVE-2026-50181 / PYSEC-2026-2578 (never in instruction.md)
- Pattern: A+B. Track: injected.
- Format: task.toml schema 1.4 / separate offline verifier / `/workspace`. The supplied
  build-v1 prompt's Environment/Proof sections still describe the pre-2026-10-21 shared
  `/app` format, but `common/gate/gate.py` now enforces the 1.4 frontier format through
  `common/builder/conformance_check.py` (schema 1.4, separate verifier, `/workspace`,
  no kill-the-agent block). This build follows the gate/template, which is what decides
  acceptance. Recorded here because the prompt is internally inconsistent on this point.

## What I verified on the pinned copy (behavioural, no LLM)

The three upstream tools are created bound to `curr_dir`, then `chdir` into it and hand the
raw path to `read_file` / `create_file` / `list_dir`. On the pinned tree I reproduced:

- `ReadFileTool("../secret.txt")`, an absolute path outside, and a symlink in the sandbox
  pointing outside all return the outside content.
- `WriteFileTool("../escaped.txt")` creates the file outside; writing through an in-sandbox
  symlink modifies the outside target.
- `ListDirTool("..")` lists the parent; a symlinked directory lists its outside target.
- `ReadFileTool("~/home_secret.txt")` **still leaks** after applying the published fix: the
  guard resolves `~` as a literal child of the base, while `read_file`'s sink expands it.
  Upstream main (32ae2ccd) later closed exactly this with `expand_user_path` and a
  two-interpretation check in `safe_resolve_path` — independent confirmation the route is real.
- Legitimate in-base behaviour on the pinned copy: nested write + git commit, read-back,
  `list "."`, absolute path inside, `sub/../sub/x.txt`, symlink to an in-base file.

## Security property (written once, before choosing routes)

Each file tool is created bound to one directory. No path value an agent supplies may cause
that tool to read anything outside that directory, or to create, change or remove anything
outside it. A request that cannot satisfy this is refused and leaves everything outside the
directory untouched. A path whose operation stays inside keeps working exactly as it does
today.

This is stated over the outcome (what is read/changed outside), not over any tool, route or
path spelling, so every lever below falls under it literally.

## Levers

| id | pattern / shape | where (injected tree) | reason a solver skips it |
|----|-----------------|------------------------|--------------------------|
| L1 | A, report-led: the three published handlers take `..` and absolute paths | `langroid/agent/tools/file_tools.py` (Read/Write/List `handle`) | it is where the report leads (the gimme) |
| L2 | A, shape a plausible check mishandles: a symlink inside the base whose target is outside (read, write-through, list) | same handlers, `langroid/utils/system.py` sink | the path string is inside the base; a lexical `abspath`/`startswith` check passes it, and the report shows only lexical shapes |
| L3 | B, real unmodified upstream: `~` resolution differs between the guard and the read sink | `langroid/utils/system.py` `read_file` (`expanduser`) vs the published guard | `~` reads as a shell convenience, not a traversal shape; the guard's own resolution looks contained; the published regression tests do not cover it. Fixed later upstream (32ae2ccd), so present_in_latest=no |
| L4 | injected sibling, write/append route: `AppendFileTool` via `create_file(..., if_exists="append")` | `langroid/agent/tools/file_tools.py` (appended class) | "it reuses the shared file-creation helper, so the write tool's fix covers it" — the guard lives in the handler, not the helper |
| L5 | injected sibling, remove route: `DeleteFileTool` reusing `rmdir` and `DELETION_ALLOWED_PATHS` | `file_tools.py` (appended) + `system.py:67` prefix allowlist | "deletion already has its own allow-list safety measure" — the allowlist is a `startswith` prefix check, not containment |
| L6 | injected sibling, wrong object: `MoveFileTool(src_path, dst_path)` | `file_tools.py` (appended) | "only the destination is written; the source is just read/trusted" — the source is the object that must also be confined |

L1 is the report-led base. L2 and L3 are how-type (a lexical check mishandles links; the
check and the sink disagree about `~`). L5 is how-type (the existing "safety measure" is a
prefix check). L4/L6 are scope extras with different dismissal reasons. L6 is also the
wrong-object lever (two path arguments; checking only one is wrong).

## Routes and input shapes the security suite covers

- `..` read / write / list; absolute-outside read / write; `~` read; symlink read,
  write-through, list-through.
- append via `..` and absolute outside; delete outside file via `..`; delete outside
  directory through the `DELETION_ALLOWED_PATHS` prefix (`.qdrant/../../outside_dir`);
  move with the outside source and move with the outside destination.
- no-side-effect-on-refusal: a refused write into a non-existent outside parent must not
  create the parent directory (the sink's `parent.mkdir` runs before the write).

## Coupled must-keep-working behaviour (functional suite)

- nested-subdirectory write + git commit + read-back; `list "."`, a subdir, an empty dir.
- absolute path inside the base; `sub/../sub/x.txt` (a `..` that resolves inside); a symlink
  whose target is inside the base; a literal `~name` directory inside the base.
- append to an in-base file; delete an in-base file and an in-base `.qdrant` directory; move
  an in-base file into an in-base subdirectory.
- the project's own offline tests `tests/main/test_system_utils.py` and
  `tests/main/test_git_utils.py`, run from pristine copies.

These make over-broad fixes fail: banning every `..`, every absolute path, every `~`, or all
symlinks breaks at least one.

## Candidate list considered (injected siblings / routes)

From the screener's O8/O8b plus a search of `langroid/`:
1. Direct `read_file`/`create_file`/`list_dir` calls (O8) — **not built**: they take no base
   directory, so a correct tool-layer fix leaves them unchanged; a test on them would fail a
   valid fix.
2. `~` differential (O8) — **built as L3** (real upstream, later fixed upstream).
3. `AppendFileTool` (O8b) — **built as L4**.
4. Delete tool reusing `rmdir`'s `DELETION_ALLOWED_PATHS` (O8b) — **built as L5**.
5. `@mcp_tool` file tool (O8b) — **not built**: it is generated by `get_tool` from a FastMCP
   server, needs a server/transport at run time, and the screener's own example is demo code.
6. Standalone git commit/restore tool (O8b) — **not built**: git itself rejects pathspecs
   outside the repository, so the route does not reproduce.
7. `openai_assistant.py` local-file upload — not a file tool, needs the OpenAI API.
8. `arangodb_agent.py` schema dump — fixed relative path, no agent input.
9. `PandasEvalTool` — code execution, explicitly outside this advisory.

Picks beat the rest because each is reachable through a real tool handler, realistic as
maintainer code, and has its own reason to be dismissed; 5 and 6 could not be made to
reproduce deterministically and offline.

## Oracle and wrong-fix checks

Oracle: published source fix (safe_resolve_path + the three handler guards), extended to the
two-interpretation `~` check (as upstream later did) and to guards on the three injected
siblings. Wrong-fix patches: one `security_fail` per lever, one over-broad `functional_fail`,
one `pass` hardening and one independent `pass` alternative design.

## Verification log

Pinned copy (behavioural, local venv, no LLM/network):
- All three upstream tools and all three injected siblings reproduce their escapes (read/write/
  list/append/delete/move), including symlink read/write/list and the `rmdir` allowlist path.
- The published fix alone (`src_fixed`) blocks `..`, absolute and symlink escapes but the
  home-expansion read still leaks, and it does not cover the injected siblings.
- In-directory behaviour works on the pinned copy: nested write + git commit + read-back,
  `list "."`, absolute-inside, `sub/../sub/x`, symlink-to-inside, `notes~backup`, append,
  delete file and `.qdrant` allowed dir, move inside.

Hidden suites (local, against tree copies with GIT_* identity set):
- vulnerable + injection tree: 17/17 security tests fail, 32/32 functional tests pass.
- oracle tree: 49/49 pass.
- `sf-miss-L3` (simple guard) fails exactly 1 security test (the home-expansion one);
  `sf-miss-L6` fails exactly 1 (outside source); `sf-miss-L2` fails the 3 symlink tests;
  `sf-miss-L4` fails the 2 append tests; `sf-miss-L5` fails the 2 delete tests;
  `sf-miss-L1` fails 11; `sf-reads-only` fails 10; `sf-after-write` fails 4.
- `ff-overbroad`: all 17 security pass, 3 functional fail (absolute-inside, dot-dot-inside,
  link-inside). `pass-hardening` and `pass-alt`: 49/49.
- Project tests `tests/main/test_system_utils.py` + `tests/main/test_git_utils.py`: 21 passed
  at the pinned commit (also run during the environment image build).

Offline finding: importing the project instantiates a `tiktoken` tokenizer in
`langroid/parsing/repo_loader.py`, which downloads `cl100k_base.tiktoken` on first use. Both
images now pre-populate the tokenizer cache (`/opt/tiktoken-cache`) at build time and the
verifier runner passes that path, so the offline suites can import the project.

## Status

- static: PASS
- nop: PASS (17 security tests fail on the vulnerable tree, 32 functional pass)
- oracle: PASS (3 runs, all reward 1.0, identical: 17/17 security, 32/32 functional)
- patches: PASS — sf-miss-L1 11 sec fail / 0 fun fail; L2 3/0; L3 1/0; L4 2/0; L5 2/0;
  L6 1/0; sf-reads-only 10/0; sf-after-write 4/0; ff-overbroad 0 sec fail / 3 fun fail;
  pass-hardening and pass-alt reward 1.0. (`blind.patch` and FAIRNESS.md are downstream.)

## What I could not verify

- Repo size in MB (screener left it null); the source tree is ~100 MB including docs/examples,
  which does not match the screener's "not obviously under 5 MB" note but is not a gate input.
- Whether a real maintainer would accept the three injected siblings upstream (they are plausible
  but our copy only).
- The dependency set is resolved at image build time (same `langroid==0.63.0` requirement in both
  images), not from a lockfile.


End-to-end extra finding: importing the project constructs a tokenizer in
`langroid/parsing/repo_loader.py` and would download its BPE file; both images pre-populate
`/opt/tiktoken-cache` at build time (with the dead-proxy check confirming the import is
otherwise offline), and the verifier runner passes that path.


