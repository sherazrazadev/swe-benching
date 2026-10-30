# Fairness review — git-js-s5

Codes: **PB** = instruction 13–16 ("…must never cause `git` to run a program of the caller's choosing, however the library passes that value to `git`… refused before `git` is started"); **C2** = 22–23 (today's behaviour keeps working); **C3** = 24–26 (only the governing existing opt-in, which still works). SEC/FUN/PRJ = hidden security / hidden functional / visible project suites.

## 1. Tests

| test (file::name) | what it asserts | fair sentence | could a correct fix fail? | risk |
|---|---|---|---|---|
| SEC::configuration::refuses a configuration write that names a long trailer command | no spawn + GitError, `config trailer.foo.command /bin/sh` | PB | no | low |
| SEC::configuration::…names a short trailer command | same, `trailer.foo.cmd` | PB | no | low |
| SEC::configuration::…names a deeper section between the parts | same, `trailer.a.b.command` | PB | no | low |
| SEC::configuration::…an inline configuration override | same, `-c trailer.a.b.command=…` | PB | no | low |
| SEC::configuration::…a clone configuration option | same, `clone --config trailer.foo.cmd=…` | PB | no | low |
| SEC::configuration::…a configuration-from-environment option | same, `--config-env trailer.foo.command=…` | PB | no | low |
| SEC::configuration::…the numbered environment | same, `GIT_CONFIG_KEY_0` under the count opt-in | PB | no | low |
| SEC::configuration::…a mixed-case configuration via the numbered environment | same, `Trailer.Foo.Command` | PB | no | low |
| SEC::configuration::…the packed environment | same, `GIT_CONFIG_PARAMETERS` `'trailer.foo.command'=…` | PB | no | low |
| SEC::configuration::…a short trailer command via the packed environment | same, `.cmd` | PB | no | low |
| SEC::configuration::…among several packed entries | same, second entry | PB | no | low |
| SEC::configuration::…a mixed-case trailer command via the packed environment | same, `Trailer.Foo.Command` | PB | no | low |
| SEC::configuration::…a packed value with spaces and quotes | same, `'sh -c "id"'` | PB | no | low |
| SEC::section rename::…into a short trailer command section | no spawn + GitError, `--rename-section legacy trailer.cmd` | PB (a rename creates the named section) | no | low |
| SEC::section rename::…an expanded trailer command section | same, `trailer.foo.command` | PB | no | low |
| SEC::section rename::…the alternate rename spelling | same, `rename-section legacy trailer.cmd` | PB | no | low |
| SEC::command options::refuses the short exec option | no spawn + GitError, `rebase -x /bin/sh` | PB | no | low |
| SEC::command options::…the long exec option with a separate value | same, `--exec /bin/sh` | PB | no | low |
| SEC::command options::…with an embedded value | same, `--exec=/bin/sh` | PB | no | low |
| SEC::command options::…an unambiguous abbreviation | same, `--exe`, `allowAbbreviatedOptions` on | standard expert knowledge: git resolves an unambiguous long-option prefix to `--exec` | no | low |
| SEC::command options::…an even shorter abbreviation | same, `--ex` | standard expert knowledge: same | no | low |
| SEC::command options::…inside a quiet cluster | same, `-qx /bin/sh` | PB | no | low |
| SEC::command options::…inside an interactive cluster | same, `-ix /bin/sh` | PB | no | low |
| SEC::command options::…inside a three-switch cluster | same, `-qix /bin/sh` | PB | no | low |
| SEC::command options::…an attached exec value | same, `-x/bin/sh` | PB | no | low |
| SEC::command options::…a history-filter option that names a program | no spawn + GitError, `filterBranch --tree-filter /bin/sh` | PB | no | low |
| SEC::command options::…a history-filter option reached through raw argv | same, `filter-branch --index-filter … -- --all` | PB | no | low |
| SEC::command options::…another history-filter option | same, `--env-filter` | PB | no | low |
| SEC::positional operands::refuses a command run in each submodule | no spawn + GitError, `submoduleForeach('/bin/sh')` | PB ("however the library passes that value") | no | low |
| SEC::positional operands::…the same command reached through raw argv | same, `submodule foreach /bin/sh` | PB | no | low |
| SEC::positional operands::…alongside other options | same, `submodule foreach --recursive /bin/sh` | PB | no | low |
| SEC::opt-in::…a configuration command when every other program opt-in is enabled | probe refused; all program opt-ins but the requested one enabled; still refused | C3 | no — discovery follows any existing category the fix requests | low |
| SEC::opt-in::…an exec switch when every other program opt-in is enabled | same | C3 | no — same | low |
| SEC::opt-in::…a history filter when every other program opt-in is enabled | same | C3 | no — passes for `allowUnsafeFilter` or `allowUnsafeExec` | low |
| SEC::opt-in::…a command run in each submodule when every other program opt-in is enabled | same | C3 | no — passes for `allowUnsafeSubmodule` or `allowUnsafeExec` | low |
| FUN::legitimate configuration writes::accepts a write of `trailer.foo.key` | one spawn, no error | C2 | no | low |
| FUN::…`trailer.foo.where` | same | C2 | no | low |
| FUN::…`trailer.foo.ifExists` | same | C2 | no | low |
| FUN::…`trailer.foo.ifMissing` | same | C2 | no | low |
| FUN::…`trailer.foo.layout` | same | C2 | no | low |
| FUN::…`trailer.separators` | same | C2 | no | low |
| FUN::…`user.name` | same | C2 | no | low |
| FUN::…an inline override of an ordinary setting | same, `-c user.name=Jane status` | C2 | no | low |
| FUN::…an ordinary setting via a clone configuration option | same | C2 | no | low |
| FUN::…an ordinary setting via the numbered environment | same, count opt-in enabled | C2 | no | low |
| FUN::…an ordinary setting via the packed environment | same, `'user.name'='Jane'` | C2 | no | low |
| FUN::…a trailer command key when the caller opted into chosen programs | probe, then spawn with the discovered opt-in | C3 | no — any existing category works; a refusal naming none fails | low/medium |
| FUN::command options::accepts a strategy, a strategy option and an interactive flag | spawn, `-s -X -i` | C2 | no | low |
| FUN::…a capitalised strategy option | spawn, `-X ours` | C2 | no (case-insensitive matching is a wrong fix) | low |
| FUN::…a cluster that does not carry the exec switch | spawn, `-qi` | C2 | no | low |
| FUN::…clean options that only select untracked files | spawn, `clean -x -f` | C2 | no | low |
| FUN::…the typed clean mode that includes the same switch | spawn, `clean('dfx')` | C2 | no | low |
| FUN::…the exec-path switch used as a getter | spawn, `rev-parse --exec-path` | C2 | no | low |
| FUN::…a history rewrite that names no program | spawn, `filterBranch --prune-empty` | C2 | no | low |
| FUN::…the same through raw argv | spawn, `filter-branch --prune-empty -- --all` | C2 | no | low |
| FUN::…a history-filter option when the caller opted into chosen programs | probe, then spawn with the discovered opt-in | C3 | no — passes for `allowUnsafeFilter` or `allowUnsafeExec` | low |
| FUN::structural edits::accepts a rename between ordinary sections | spawn, `branch.old → branch.new` | C2 | no | low |
| FUN::…the alternate rename spelling between ordinary sections | spawn | C2 | no | low |
| FUN::…a submodule status report | spawn | C2 | no | low |
| FUN::…a submodule summary report | spawn | C2 | no | low |
| FUN::…a submodule status report for a path named foreach | spawn, `submodule status foreach` | C2 | no | low |
| FUN::…a command run in each submodule when the caller opted into chosen programs | probe, then spawn with the discovered opt-in | C3 | no — any existing category the fix requests works | low/medium |
| FUN::…keeps tokens after the argument separator as paths | spawn, `add -- file.ts` | C2 | no | low |
| FUN::option's own opt-in::push asks only for its own opt-in | no spawn; message names `allowUnsafePack`, not `allowUnsafeExec` | C3 | no | low |
| FUN::option's own opt-in::push permitted by that opt-in alone | spawn with `allowUnsafePack` | C3 | no | low |
| PRJ::parse-argv.spec.ts (5) | exact `ParsedArgv` shape for five forms | C2 (visible test) | no — keep `positionals` internal | low |
| PRJ::parse-flags.spec.ts (11) | clusters, consumed values, `clone -xu` stays opaque | C2 | no | low |
| PRJ::parse-paths.spec.ts (7) | `--` separator, pathspec unwrapping | C2 | no | low |
| PRJ::parse-config-read.spec.ts (10) | read detection and scopes | C2 | no | low |
| PRJ::parse-config-write.spec.ts (14) | writes, scopes, key lowercasing; pre-fix rename case removed | C2 | no — the case a correct fix must change is not graded | low |
| PRJ::parse-config-inline.spec.ts (8) | `-c`, `--config`, `--config-env` writes | C2 | no | low |
| PRJ::parse-env.spec.ts (20) | env→category map; legacy `'core.pager=cat'` yields only `allowUnsafeConfigEnvCount` | C2 (visible test) | no — a fix also parsing the legacy spelling fails, but the visible row pins it | medium |
| PRJ::task-detection.spec.ts (7) | task identification, incl. rebase | C2 | no | low |
| PRJ::attack-vectors.spec.ts (8) | inline write collection; `clone -xu` yields no write | C2 | no | low |
| PRJ::vulnerability-analysis.spec.ts (many) | exact categories; existing keys keep their own category | C2 | no — a generic suffix rule must dedupe | low |
| PRJ::vulnerability-check.spec.ts (3) | combined env + argv categories | C2 | no | low |
| PRJ::simple-git rebase.spec.ts (3) | typed rebase argv | C2 | no | low |
| PRJ::clean.spec.ts (17) | clean argv incl. `-x`, `dfx`; mode errors | C2 | no | low |
| PRJ::push.spec.ts (many) | push argv and parsers | C2 | no | low |
| PRJ::rev-parse.spec.ts (3) | rev-parse argv | C2 | no | low |
| PRJ::config.spec.ts (many) | config list/get parsing | C2 | no | low |
| PRJ::plugin.unsafe.spec.ts (many) | existing refusals/opt-ins, incl. push `--exec`→`allowUnsafePack` | C2/C3 | no | low |
| PRJ::plugins.allow-environment.spec.ts (9) | env filter vs `allowEnvironment` layering | C2 | no | low |

## 2. Leniency (non-blocking)

- **T1**: only `trailer.command`/one channel → 13 SEC; `miss_t1`.
- **T2**: no switch table → `-qx`/`-ix`/`-qix`/`-x<cmd>` (`sf_row_only`); global `-x` → clean (`ff_global_x`); case-insensitive → `-X ours` (`ff_case_insensitive`); exact `--exec` → abbreviations.
- **T3**: source/one spelling → 3 SEC (`miss_t3`); refuse-all → 2 functional.
- **T4**: covered/first-only/case-sensitive → 5 SEC (`miss_t4`).
- **I1**: off-path/typed-only → 3 SEC (`miss_i1`); any operand → `submodule status foreach`.
- **I2**: one filter → 3 SEC (`miss_i2`).
- **Uncaught**: legacy `'key=value'` packed form; `core.alternateRefsCommand`; `bisect run`, `grep -O`, `archive --exec`, `difftool -x`; refuse-all (`ff_overbroad`).

## 3. Hints

None: no file, route, mechanism, trap, variant list or flaw count is named.

## 3a. Required: generalize

none.

## Quality to tighten

1. Accept any `PROGRAM_OPT_INS` name in the message, not only `without enabling X`.
2. Add a hidden legacy `'key=value'` packed case, or relax the visible row.
3. Test `core.alternateRefsCommand` and `bisect run`/`difftool -x`/`grep -O`.
4. Assert repository/environment unchanged.
5. Say existing tests may encode the old behaviour.

## 4. Realism

No flags. T1 advisory; T2–T4 real upstream; I1/I2 ordinary injected typed methods via the public API; `filterBranch` weakest but plausible.

## Verdict

**READY (gate a).** The general property literally covers every tested route and names none. The natural fix refuses before spawn, keeps legitimate values working and needs only an existing opt-in category; reference, `pass_alt`, `pass_hardening` and `blind` all score 1.0, and a spawn-boundary guard meets the same observables. Round 1's pinned-opt-in unfairness is fixed: both suites discover the requested category and accept any existing opt-in. Residual risk — discovery relies on the library's `without enabling <category>` message (visible in the guard source; C3 says "request") — is quality, not a correct fix that cannot pass.

Human review: confirm discovery may rely on the existing "without enabling <opt-in>" message convention, and that the legacy `'key=value'` packed form is out of scope.

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
