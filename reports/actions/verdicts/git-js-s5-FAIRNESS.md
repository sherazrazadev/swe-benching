# Fairness review — git-js-s5

Fair-because codes:
- **PB** = Required behaviour: "For every invocation the library builds, a value supplied by the application's caller must never cause `git` to run a program of the caller's choosing, however the library passes that value to `git` ... Every such value must be refused before `git` is started."
- **C2** = "Everything that works today keeps working exactly as today."
- **C3** = "An operation that already has its own opt-in must keep asking for that same opt-in and no other ..."

SEC = `tests/security/vulnerability-security.spec.mts`; FUN = `tests/functional/vulnerability-functional.spec.mts`.

## 1. Test coverage

| test | asserts | fair because | could a correct fix fail? | risk |
|---|---|---|---|---|
| SEC::refuses a long trailer command | no spawn + Error for `config trailer.foo.command /bin/sh` | PB | no — explicit row or suffix rule works | low |
| SEC::refuses a short trailer command | same for `trailer.foo.cmd` | PB | no | low |
| SEC::refuses a deeper section | same for `trailer.a.b.command` | PB | no — expanded-key rule | low |
| SEC::refuses an inline override | same for `-c trailer.a.b.command=...` | PB | no | low |
| SEC::refuses a clone config option | same for `clone --config ...` | PB | no | low |
| SEC::refuses a config-from-environment option | same for `--config-env` | PB | no | low |
| SEC::refuses the numbered environment | same via `GIT_CONFIG_KEY_0` | PB | no | low |
| SEC::refuses the packed environment | same via `GIT_CONFIG_PARAMETERS` | PB | no — must unpack | low |
| SEC::refuses a short packed key | same, `trailer.foo.cmd` | PB | no | low |
| SEC::refuses a packed key among several | same, second entry | PB | no | low |
| SEC::rename into short trailer section | no spawn + Error for `--rename-section ... trailer.cmd` | PB (rename creates the written section) | no | low |
| SEC::rename into expanded trailer section | same, `trailer.foo.command` | PB | no | low |
| SEC::alternate rename spelling | same via `rename-section` verb | PB | no — both spellings | low |
| SEC::short exec option | no spawn + Error for `rebase -x` | PB (rebase execs a program) | no | low |
| SEC::long exec option, separate value | same `--exec /bin/sh` | PB | no | low |
| SEC::long exec option, embedded | same `--exec=...` | PB | no | low |
| SEC::abbreviation of long exec | same `--exe` | PB (git resolves abbreviations) | no | low |
| SEC::exec in quiet cluster | same `-qx` | PB | no — needs switch table | low |
| SEC::exec in interactive cluster | same `-ix` | PB | no | low |
| SEC::exec in three-switch cluster | same `-qix` | PB | no | low |
| SEC::attached exec value | same `-x/bin/sh` | PB | no | low |
| SEC::history-filter option | no spawn + Error for typed `--tree-filter` | PB | no | low |
| SEC::history-filter via raw argv | same `--index-filter` | PB | no | low |
| SEC::another history-filter | same `--env-filter` | PB | no | low |
| SEC::command in each submodule | no spawn + Error for `submoduleForeach('/bin/sh')` | PB ("however ... passes") | no | low |
| SEC::same command via raw argv | same `submodule foreach /bin/sh` | PB | no | low |
| SEC::command alongside options | same with `--recursive` | PB | no | low |
| FUN::accepts trailer.foo.key | spawn, no Error | C2 | no | low |
| FUN::accepts trailer.foo.where | same | C2 | no | low |
| FUN::accepts trailer.foo.ifExists | same | C2 | no | low |
| FUN::accepts trailer.foo.ifMissing | same | C2 | no | low |
| FUN::accepts trailer.foo.layout | same | C2 | no | low |
| FUN::accepts trailer.separators | same | C2 | no | low |
| FUN::accepts user.name | same | C2 | no | low |
| FUN::accepts inline ordinary setting | same | C2 | no | low |
| FUN::accepts ordinary clone config | same | C2 | no | low |
| FUN::accepts ordinary numbered env | same | C2 | no | low |
| FUN::accepts ordinary packed env | same | C2 | no | low |
| FUN::accepts trailer command under opt-in | spawn with `allowUnsafeCommandBinaries`+`allowUnsafeExec` | C3 | no — either category passes | low |
| FUN::accepts strategy/strategy-option/interactive | spawn for `-s -X -i` | C2 | no | low |
| FUN::accepts capitalised strategy option | spawn for `-X ours` | C2 | no — case-sensitive matcher | low |
| FUN::accepts non-exec cluster | spawn for `-qi` | C2 | no | low |
| FUN::accepts clean `-x -f` | spawn | C2 | no — task-scoped | low |
| FUN::accepts typed clean `dfx` | spawn | C2 | no — task-scoped | low |
| FUN::accepts `--exec-path` getter | spawn | C2 | no | low |
| FUN::accepts filter-branch without filters | spawn | C2 | no | low |
| FUN::accepts raw filter-branch without filters | spawn | C2 | no | low |
| FUN::accepts filter under opt-in | spawn with `allowUnsafeExec`+`allowUnsafeCommandBinaries` | C3 | no — either category passes | low |
| FUN::accepts ordinary rename | spawn | C2 | no | low |
| FUN::accepts alternate ordinary rename | spawn | C2 | no | low |
| FUN::accepts submodule status | spawn | C2 | no — rule must be scoped | low |
| FUN::accepts submodule summary | spawn | C2 | no | low |
| FUN::accepts submodule command under opt-in | spawn | C3 | no | low |
| FUN::keeps tokens after `--` as paths | spawn | C2 | no | low |
| FUN::push asks only for its own opt-in | Error matches `allowUnsafePack`, not `allowUnsafeExec` | C3 | no — rebase-scoped rule leaves push alone | low |
| FUN::push permitted by its opt-in alone | spawn with `allowUnsafePack` | C3 | no | low |
| project/argv-parser `parse-argv.spec.ts` (full shape) | exact `ParsedArgv` keys | C2 (visible upstream test) | no — thread positionals without adding a public field | low |
| project/argv-parser `parse-config-{read,write,inline}.spec.ts` | existing config parsing | C2 | no | low |
| project/argv-parser `parse-env.spec.ts` | exact vulnerability arrays; legacy `'core.pager=cat'` yields only `allowUnsafeConfigEnvCount` | C2 (visible upstream test) | no for the stated mechanism; a fix that also parses the legacy `'key=value'` spelling adds `allowUnsafePager` and fails — see Quality | low |
| project/argv-parser `parse-flags.spec.ts` | existing flag parsing | C2 | no | low |
| project/argv-parser `parse-paths.spec.ts` | existing path parsing | C2 | no | low |
| project/argv-parser `task-detection.spec.ts` | existing task detection | C2 | no | low |
| project/argv-parser `vulnerability-analysis.spec.ts` | exact vulnerability categories | C2 | no — generic suffix rule must de-dupe (pass_alt shows how) | low |
| project/argv-parser `vulnerability-check.spec.ts` | existing env checks | C2 | no | low |
| project/argv-parser `attack-vectors.spec.ts` | existing config collection | C2 | no | low |
| project/simple-git unit rebase/clean/push/rev-parse/config/plugin.unsafe/allow-environment | command construction and existing opt-ins | C2/C3 | no | low |

## 2. Leniency
Caught: T1 exact-key/positional-only → SEC long/short/deeper + channel rows (`miss_t1`); T1/T4 env-only → `miss_t4`; T2 row without switch table → `sf_row_only` (clusters/attached); task-agnostic `-x` → `ff_global_x` (clean); case-insensitive → `ff_case_insensitive` (`-X`); T3 source-key → `miss_t3`; option-only rename → SEC alternate spelling; I1 no positionals → `miss_i1`; I2 one filter → SEC index/env rows; refuse-all → `ff_overbroad`.

No test catches: packed key not lower-cased; wrong opt-in category for T1/T2/I1/I2 (both opt-ins enabled); overbroad "foreach anywhere"; `--ex`; crash-shaped non-Error; repo/env mutation before refusal; task-agnostic `--*-filter`.

## 3. Required: generalize
1. "For example: `await git.raw(['config', 'trailer.summary.command', value]);` records a value that a later history-reading operation executes as a program." — names API, key family and consumer. Delete; state PB once.
2. "A caller-supplied value can still be recorded in the repository's configuration as a command that a later ordinary operation runs." — channel/stage. Reword: "A caller-supplied value can still cause `git` to run a program of the caller's choosing."
3. "Configuration and options that do not name a program keep working, including values that merely sit beside a program-naming setting and the same switch used by another operation." — variant list. Reword: "Values that do not name a program keep working."
4. "Values passed as ordinary arguments rather than as settings keep working." — channel list; reads as excluding I1. Reword: "Values that do not name a program keep working, however they are supplied."
5. "An operation that already has its own opt-in ... and no other ..." — points at push. Reword: "Each invocation must request only the opt-in governing the capability it uses."
6. "The example above is an example, not the full set." — flaw count. Delete.
7. "Fix the problem and its close variants." Reword: "Fix the problem for every invocation."
8. "Do not special-case the example." Reword: "Do not special-case one input."

## 4. Realism
No flags: T1 is the advisory route; T2–T4 are real unmodified upstream sites; I1/I2 are ordinary typed operations, visible and reachable through the public API; the recording stand-in observes only spawn/no-spawn.

## Quality to tighten
- Pin the opt-in category: FUN's opt-in tests should enable only the expected category and assert the other is closed.
- Add mixed-case packed-key, `--ex`, and space/quote-value security cases; add functional `submodule status foreach`.
- Change the `parse-env.spec.ts` fixture to the modern `'core.pager'='cat'` form.
- Optionally assert the client-error type and unchanged repo/env.

**Verdict:** READY. All 27 security tests drive a caller value that makes git run a program and observe no spawn + Error; PB covers config, switches, env and operands ("however the library passes that value"). All functional tests are stated must-keep-working cases, and the harness observes only spawn/no-spawn, so any valid guard layer passes. Reference, `pass_alt`, `pass_hardening` and the blind patch all pass. The only failing alternative is a legacy packed-env parser, which conflicts with the visible regression test and "exactly as today"; the primary mechanism passes.

Human review: confirm that "Values passed as ordinary arguments rather than as settings keep working" cannot be read as excluding the positional-operand route (I1), and whether the legacy packed-env project assertion should be relaxed.

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
