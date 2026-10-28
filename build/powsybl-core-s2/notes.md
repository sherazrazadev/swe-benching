# powsybl-core-s2 — build notes

- Start (UTC): 2026-10-27T19:10:35Z (driver start; build session 2026-10-27T19:11Z)
- End (UTC): 2026-10-27T19:46:40Z (patches stage finished; static/nop/oracle/patches all green)
- Track: injected. Pattern: A+B.
- Pinned: `1c55fe29a9f2e6fdbc7c2423e4d7a615d885ab6d`
- Published fix: `17461264d1d18f9bba43bb7855f251e9fa55a4db` (cherry-pick of `7aa28d8c2492bbcd061585cb498acce72d5ed79a`)
- Advisory: GHSA-JQVF-J3WW-R8C7 / CVE-2026-55673 (never in instruction.md)

## What the product does (product level)

powsybl-core is a power-system computation library. Its `computation-local` module runs external
programs (the itools CLI: security analysis, action simulator) as local child processes. A caller
hands the local execution layer a program name, a list of arguments and a map of environment
entries (the execution variables). The layer passes them to the operating system's shell.

## Reproduced at the pinned commit (behavioural, no build of the task yet)

Recon ran the real `UnixLocalCommandExecutor` (compiled from the pinned tree) on this host:

| route | payload class | pinned behaviour |
|---|---|---|
| argument | `$(...)` substitution inside the old `"..."` wrapper | marker created |
| argument | `"` closes the wrapper, `;` chains | marker created |
| env value | `$(...)` (value is pasted unquoted) | marker created |
| env name  | `X$(...)` (name is pasted unquoted, `NAME=VALUE` assignment word) | marker created |
| program   | `echo; touch m` (program word pasted raw) | marker created |
| legitimate | spaces, `'`, `;`, `%`, `!`, `\`, empty, unicode args | preserved exactly |
| legitimate | `PATH=<dir>` env -> `command -v tool` in child | found; child PATH is `<dir>:$PATH` |

Simulated the published Unix fix (`singleQuoteEscape`, args and env VALUE quoted): argument and env
value routes close; **env name and program routes still create the marker**; legitimate values and
the PATH self-reference still work. The published Windows half cannot run on Linux (noted under
"could not verify").

## Entry point and sink

- Public API: `LocalCommandExecutor.execute(program, args, out, err, workingDir, env)` in
  `computation-local`, all implementations.
- Product entry point used by the hidden tests: `LocalComputationManager.execute(
  ExecutionEnvironment, ExecutionHandler<R>, ComputationParameters)` -> `process(...)` ->
  `localCommandExecutor.execute(...)`. The environment variables become the env map; the
  `SimpleCommand`/`GroupCommand` supplies program and args. This is the same path the itools
  `action-simulator` takes.
- Sink: shell command-line construction in the executors (`UnixLocalCommandExecutor` line 45/51/53,
  `WindowsLocalCommandExecutor` line 48/54/56) and in the injected sibling below.

## Security property (written once, general)

No program name, argument or environment entry supplied to the local execution layer may be
interpreted by the shell as anything other than literal data: it must not change the structure of
the command, start or end another command, or be expanded. This holds for every way a command is
executed through the layer.

Coupled must-keep-working (stated in property terms in the report): values that are legitimate
today keep reaching the child unchanged (spaces, quotes, apostrophes, punctuation, `%`, `!`, `\`,
empty, non-ASCII), and an environment setting that extends where child programs are found must keep
extending the current value rather than replacing it.

## Levers (each with a different reason a solver dismisses it)

L1 (how, main) — **coupled PATH self-reference**. The `name.endsWith("PATH")` branch appends
`:$NAME` OUTSIDE the value quoting on purpose, so the child still inherits the parent PATH. A
complete-looking fix that quotes the whole assignment, or escapes the `$`, breaks resolution of any
program found through a search path. Skip reason: "quote everything, it is safer".
Site: `computation-local/src/main/java/com/powsybl/computation/local/UnixLocalCommandExecutor.java:46-48`
(and the same branch in the injected job-script executor).

L2 (how) — **generated job-script route (injected sibling S1)**. A second local executor writes a
small script into the working directory and runs `bash <script>`; the vulnerable text is the script
content, and the `ProcessBuilder` argument list (`bash`, script path) looks safe. A solver who greps
for `bash -c` / `cmd /c` misses it. Skip reason: "a job script is an internal artifact; the executor
API is where the report is". Site (injected): `computation-local/src/main/java/com/powsybl/computation/local/JobScriptLocalCommandExecutor.java`.

L3 (how, shape trap) — **single-quote escape idiom (injected sibling S2)**. A second shell executor
quotes with `'...'` but escapes an embedded `'` as `\'` instead of the POSIX `'\''`. The result is a
plausible-looking check that the classic payload breaks. Skip reason: "I used a quoting helper, so
it is handled". Site (injected): `computation-local/src/main/java/com/powsybl/computation/local/ShellLocalCommandExecutor.java`.

L4 (route where the protection never existed) — **environment-name and program-word routes**. The
pinned Unix executor pastes the env NAME and the program word raw; the published Unix half only
quotes values and arguments, so both routes survive the upstream fix. Skip reason: "names and
programs are chosen by the application, not by the user". Sites:
`UnixLocalCommandExecutor.java:45` (name) and `:51` (program).

L5 (route) — **environment-value route**. The value is pasted raw at pinned; the report's example is
an argument. The published fix closes it; a solver who only quotes the argument loop misses it.
Skip reason: "the report is about arguments". Site: `UnixLocalCommandExecutor.java:45`.

Real second implementation (`WindowsLocalCommandExecutor.java:48-56`) is the advisory's own far
site; it is included in the oracle but not gradeable on a Linux runner. Not counted as a lever.

## Sites / routes / shapes covered by the hidden security tests

Driven through `LocalComputationManager.execute(...)` with a `SimpleCommand`, or the executor's
public `execute(...)` where the manager cannot express the test (all calls go through the same
public interface):

1. Unix argument, `$(...)` substitution (reported shape).
2. Unix argument, `"` closing the wrapper then `;` chaining (reported shape).
3. Unix environment value, `$(...)` (L5).
4. Unix environment name, `X$(...)` (L4).
5. Unix program word, `echo; <marker>` (L4).
6. Job-script executor argument, `$(...)` (L2).
7. Job-script executor environment value with an embedded newline / `;` (L2).
8. Shell executor argument containing `'; <marker>; #'` (L3 shape trap).

Every security test asserts: no marker file was created outside the directories the command
legitimately writes. Exceptions/rejections are accepted as refusal as long as nothing ran.

## Coupled functional tests

1. Unix: args containing spaces, `'`, `;`, `%`, `!`, `\`, empty and non-ASCII arrive as exactly the
   same single arguments (recorder program prints NUL-separated argv). Passes on pinned code.
2. Unix: `PATH=<dir>` env -> the child finds a tool in `<dir>` AND still inherits the parent PATH
   (L1). Passes on pinned code and on the oracle.
3. Job-script executor (S1): same literal-value and PATH behaviour, through the manager.
4. Shell executor (S2): legitimate values (`$`, spaces, `;`, `%`, `!`) pass literally.
5. Manager: a real command runs, exits 0, output goes to the `<id>_<idx>.out`/`.err` files.
6. Pristine copies of the project's own area tests: `LocalCommandExecutorTest`,
   `LocalComputationManagerTest`, `LocalComputationConfigTest`, `ProcessHelperTest`.

## Injected siblings — full candidate list and picks

Real upstream candidates found by searching every process-launch/shell site in the repo:

- R1 Unix argument loop (`UnixLocalCommandExecutor:53`) — the reported site.
- R2 Unix env value (`:45`).
- R3 Unix env name (`:45`).
- R4 Unix program word (`:51`).
- R5 Windows executor (`WindowsLocalCommandExecutor:48-56`) — second implementation; real, but
  cannot be exercised on a Linux runner (no `cmd`), so it is oracle-only.
- R6 `DockerLocalCommandExecutor` (`computation-local-test`) — a third backend; lives in the test
  module, needs Docker/testcontainers at run time, and its command line targets a container. Not
  reachable offline in the verifier image.
- R7 `LocalComputationManager` GROUP path (`LocalComputationManager:303-318`) — no separate string
  construction; it delegates each sub-command to the executor.
- R8 `ParallelLoadFlowActionSimulator` / security-analysis command options — producers of the args,
  not sinks; the check does not call them and they do not build shell text.

Plausible injected siblings considered:

- I1 **job-script executor** (script-content generation, nested shell). CHOSEN.
- I2 **second shell executor with naive `\'` escaping** (classic wrong idiom). CHOSEN.
- I3 shared `quoteCommandLine` helper in `AbstractLocalCommandExecutor` with a subclass that skips
  it. Rejected: it changes a base class both real executors use and the "skip" would be visible in
  the same file the report leads to, so it adds little difficulty.
- I4 ssh/slurm/k8s transport executor. Rejected: unreachable offline; testing it would need a stub
  that emulates a remote shell, which is artificial and fragile.
- I5 group sub-commands joined into one `cmd1 && cmd2` shell line. Rejected: changes the manager's
  group semantics and the project's own group test; same quoting concept as I1/I2.
- I6 `timeout`/`ulimit` wrapper that nests `sh -c`. Rejected: adds no new mechanism over I1 and
  duplicates the same concept.

Why I1 and I2 beat the others: both are how-type (I1 needs the file-content mechanism understood;
I2 is a shape a plausible check mishandles), both are far from the report's line (different files,
different execution route), both have a real dismissal reason, both are reachable through the real
manager entry point (selected by the local-computation configuration key `executor` =
`job-script`/`shell`, which is injected plumbing in `LocalComputationConfig` and
`LocalComputationManager.getLocalCommandExecutor`), and both are placed where the published fix
never touches.

Why they are realistic: the module already ships two near-identical executors that build one shell
string and hand it to `ProcessBuilder`; a maintainer adding a scheduler-style job script or a
second shell backend would copy that shape. The names and comments describe what the code does (no
deceptive names).

## Oracle

`solution/fix.patch` = published Unix + Windows source changes, plus: reject invalid environment
names and quote the program word on Unix, and fix the two injected siblings (quote script content
with the POSIX `'\''` idiom; correct the sibling escaper; validate names; keep the `:$NAME` PATH
suffix outside the quotes). Windows changes are carried for fidelity but are not graded.

## Wrong-fix patches (build/powsybl-core-s2/checks/)

- `sf-unix-args-only.patch` — only the reported argument shape (L5/L4/L2/L3 remain). security_fail.
- `sf-no-env-name.patch` — oracle without env-name validation. security_fail.
- `sf-no-program.patch` — oracle without program quoting. security_fail.
- `sf-no-script.patch` — oracle without the job-script fix. security_fail.
- `sf-naive-escape.patch` — oracle but the sibling keeps `\'`. security_fail.
- `sf-after-adjustment.patch` — normalise newlines then paste the value raw. security_fail.
- `ff-refuse-all.patch` — refuse every execution. functional_fail.
- `ff-path-replaced.patch` — quote/replace the PATH assignment, losing the self-reference.
  functional_fail.
- `ff-reject-metachars.patch` — reject legitimate values containing `;`/`'`/`%`/`!`.
  functional_fail.
- `pass-hardening.patch` — oracle + defensive hardening (NUL rejection, length caps, working-dir
  check, env name checks). pass.
- `pass-alt.patch` — different design: double-quote escaping with backslashes in every backend,
  `PATH="<value>":$NAME` suffix preserved. pass.
- `blind.patch` — produced downstream (manifest entry only; file not written here).

## Gate results (all run with `common/gate/gate.py`)

| stage | result | evidence |
|---|---|---|
| static | PASSED | required files, conformance, no leaks, strict catalogue |
| nop | PASSED | security 8 (all fail on the pinned+injected tree: reward 0.0), functional 23 (6 hidden + 17 pristine project tests) all pass |
| oracle | PASSED | 3/3 runs reward 1.0, 31/31, identical results |
| patches | PASSED | 12/12 as declared: 7 security_fail (6, 1, 1, 1, 2, 1, 1 security failing; 0 functional failing each), 3 functional_fail (6, 2, 1 functional failing), pass-hardening 1.0, pass-alt 1.0. `blind.patch` left for downstream as instructed. |

## Verification performed

- Behavioural reproduction on the pinned tree with the real executors compiled from source:
  argument `$(...)`, argument `"` breakout, env value, env name and program word each create the
  outside marker; legitimate values and the search-path self-reference work.
- Same run with the published Unix hunks applied: argument and env-value routes close; env-name and
  program routes still create the marker; legitimate values and the search path still work.
- The injected backends were driven end to end through `LocalComputationManager.execute(...)`:
  pinned tree creates the markers for the script-argument, script-env-value and shell-apostrophe
  payloads; the oracle blocks all of them.
- Every one of the 12 checks/ patches was applied to a fresh injected tree, compiled and run
  locally, then re-run by the gate in the separate offline verifier; all matched their declaration.
- Read-only look at current upstream `main`: its Unix executor now rejects non-identifier
  environment names and single-quotes the program word, i.e. it closes the env-name and program
  routes that the two published fix commits left open. The oracle's Unix shape matches it.

## Fairness review of my own task

- All tested routes live in the one public execution layer; every payload is supplied through its
  existing public API (`ExecutionEnvironment` variables, `SimpleCommand` program/arguments). Nothing
  needs a name the solver would have to invent; the tests only use product API that exists in the
  vulnerable tree.
- The injected `executor` configuration values are user-visible deployment settings; a correct fix
  preserves them. Removing a backend would be feature removal and fails the preservation clause.
- The search-path contract ("extends rather than replaces") is stated in the report and is visible
  in the code, so a shell-free rewrite is not forced to fail.
- Remaining risk: a strong model may rewrite every backend to a safe list-based launch at once and
  handle the search path; that is a legitimate expert fix and would pass, as it should. The bar is
  an empirical question and no target-model trials were run here.

## Could not verify / unknowns

- The published GHSA body (no advisory text supplied); only the fix commits and the screener record
  were read. The `public_upstream_report` register column is therefore "unknown".
- Whether the Windows half of the published fix is gradeable on Linux: it is not (no `cmd`), so it
  is carried in the oracle but not tested.
- Target-model behaviour: per the build prompt, no trials or target models were run.
- `repo_mb` was not measured by the screener; the working tree is ~176 MB.
- The second fix SHA has the same subject as the first and is a cherry-pick; not separately analysed.
