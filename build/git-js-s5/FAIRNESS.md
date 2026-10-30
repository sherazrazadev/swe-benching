# Fairness review — git-js-s5

Codes: **PB** = "…must never cause `git` to run a program of the caller's choosing, however the library passes that value to `git`… Every such value must be refused before `git` is started." **C2** = "Everything that works today keeps working exactly as today. Values that do not name a program keep working, however they are supplied." **C3** = "the existing opt-in that permits caller-chosen programs" + "Each invocation must request only the opt-in governing the capability it uses…".

## 1. Tests

SEC = `tests/security/vulnerability-security.spec.mts`; FUN = `tests/functional/vulnerability-functional.spec.mts`; PRJ = the project's own suites restored by `test.sh`.

| test | asserts | fair sentence | correct fix could fail? | risk |
|---|---|---|---|---|
| SEC::refuses a configuration write that names a long trailer command | no spawn+Error, `config trailer.foo.command /bin/sh` | PB | no | low |
| SEC::…a short trailer command | same, `trailer.foo.cmd` | PB | no | low |
| SEC::…a deeper section between the parts | same, `trailer.a.b.command` | PB | no | low |
| SEC::…an inline configuration override | same, `-c trailer.a.b.command=…` | PB | no | low |
| SEC::…a clone configuration option | same, `clone --config …` | PB | no | low |
| SEC::…a configuration-from-environment option | same, `--config-env trailer.foo.command=…` | PB | no | low |
| SEC::…the numbered environment | same, `GIT_CONFIG_KEY_0` | PB | no | low |
| SEC::…the packed environment | same, `GIT_CONFIG_PARAMETERS` | PB | no | low |
| SEC::…a short trailer command via packed env | same, `trailer.foo.cmd` | PB | no | low |
| SEC::…a trailer command among several packed entries | same, second entry | PB | no | low |
| SEC::…a mixed-case trailer command via packed env | same, `Trailer.Foo.Command` | PB | no | low |
| SEC::…a packed value with spaces and quotes | same, `sh -c "id"` | PB | no | low |
| SEC::refuses a rename into a short trailer command section | no spawn+Error, `--rename-section legacy trailer.cmd` | PB (a rename creates the named section) | no | low |
| SEC::…an expanded trailer command section | same, `trailer.foo.command` | PB | no | low |
| SEC::…the alternate rename spelling | same, `rename-section` verb | PB | no | low |
| SEC::refuses the short exec option | no spawn+Error, `rebase -x /bin/sh` | PB | no | low |
| SEC::…the long exec option with a separate value | same, `--exec /bin/sh` | PB | no | low |
| SEC::…the long exec option with an embedded value | same, `--exec=/bin/sh` | PB | no | low |
| SEC::…an unambiguous abbreviation | same, `--exe`, `allowAbbreviatedOptions` on | PB (git resolves abbreviations) | no | low |
| SEC::…an even shorter abbreviation | same, `--ex` | PB | no | low |
| SEC::…the exec option inside a quiet cluster | same, `-qx /bin/sh` | PB | no | low |
| SEC::…inside an interactive cluster | same, `-ix /bin/sh` | PB | no | low |
| SEC::…inside a three-switch cluster | same, `-qix /bin/sh` | PB | no | low |
| SEC::…an attached exec value | same, `-x/bin/sh` | PB | no | low |
| SEC::refuses a history-filter option that names a program | no spawn+Error, `filterBranch --tree-filter /bin/sh` | PB | no | low |
| SEC::…history filter through raw argv | same, `--index-filter … -- --all` | PB | no | low |
| SEC::…another history-filter option | same, `--env-filter` | PB | no | low |
| SEC::refuses a command run in each submodule | no spawn+Error, `submoduleForeach('/bin/sh')` | PB ("however … passes") | no | low |
| SEC::…the same command through raw argv | same, `submodule foreach /bin/sh` | PB | no | low |
| SEC::…alongside other options | same, `submodule foreach --recursive /bin/sh` | PB | no | low |
| SEC::refuses a configuration command when only the exec opt-in is enabled | still no spawn with `allowUnsafeExec` | C3 | **maybe** — a fix routing config command keys to `allowUnsafeExec` is refused | medium |
| SEC::refuses an exec switch when only the command-binary opt-in is enabled | still no spawn with `allowUnsafeCommandBinaries` | C3 | **maybe** — a fix routing the exec switch to the command-binary opt-in is refused | medium |
| SEC::refuses a history filter when only the command-binary opt-in is enabled | still no spawn with `allowUnsafeCommandBinaries` | C3 | **maybe** — same | medium |
| SEC::refuses a command in each submodule when only the command-binary opt-in is enabled | still no spawn with `allowUnsafeCommandBinaries` | C3 | **maybe** — same | medium |
| FUN::accepts a write of `trailer.foo.key` / `.where` / `.ifExists` / `.ifMissing` / `.layout` / `trailer.separators` / `user.name` (it.each, 7) | one recorded spawn, no Error | C2 | no | low |
| FUN::accepts an inline override of an ordinary setting | same, `-c user.name=Jane status` | C2 | no | low |
| FUN::accepts an ordinary setting via clone configuration | same, `clone --config user.name=…` | C2 | no | low |
| FUN::accepts an ordinary setting via the numbered environment | same, `GIT_CONFIG_COUNT` with the count opt-in | C2 | no | low |
| FUN::accepts an ordinary setting via the packed environment | same, `'user.name'='Jane'` | C2 | no | low |
| FUN::accepts a trailer command key under the caller's opt-in | spawn with `allowUnsafeCommandBinaries` only | C3 | **maybe** — a fix routing configuration keys to `allowUnsafeExec` is refused | medium |
| FUN::accepts a strategy, a strategy option and an interactive flag | spawn, `-s -X -i` | C2 | no | low |
| FUN::accepts a capitalised strategy option | spawn, `-X ours` | C2 | no (a case-insensitive matcher fails it — wrong fix) | low |
| FUN::accepts a cluster that does not carry the exec switch | spawn, `-qi` | C2 | no | low |
| FUN::accepts clean options that only select untracked files | spawn, `clean -x -f` | C2 | no | low |
| FUN::accepts the typed clean mode with the same switch | spawn, `clean('dfx')` | C2 | no | low |
| FUN::accepts the exec-path switch used as a getter | spawn, `rev-parse --exec-path` | C2 | no | low |
| FUN::accepts a history rewrite that names no program | spawn, `filterBranch --prune-empty` | C2 | no | low |
| FUN::…the same through raw argv | spawn, `filter-branch --prune-empty -- --all` | C2 | no | low |
| FUN::accepts a history-filter option under the caller's opt-in | spawn with `allowUnsafeExec` only | C3 | **yes** — a fix routing filters to `allowUnsafeFilter` (an existing opt-in governing filter config commands) is refused; recorded in `build/git-js-s5/evidence/20261029T223601Z-trial-git-js-s5-mimo-r1-…` | high |
| FUN::accepts a rename between ordinary sections | spawn, `--rename-section branch.old branch.new` | C2 | no | low |
| FUN::…the alternate rename spelling | spawn, `rename-section …` | C2 | no | low |
| FUN::accepts a submodule status report | spawn, `submodule status` | C2 | no | low |
| FUN::accepts a submodule summary report | spawn, `submodule summary` | C2 | no | low |
| FUN::accepts a submodule status report for a path named foreach | spawn, `submodule status foreach` | C2 | no | low |
| FUN::accepts a command in each submodule under the caller's opt-in | spawn with `allowUnsafeExec` only | C3 | **yes** — a fix routing the operand to `allowUnsafeSubmodule` (the existing opt-in for submodule commands) is refused; recorded in the same evidence file | high |
| FUN::keeps tokens after the argument separator as paths | spawn, `add -- file.ts` | C2 | no | low |
| FUN::push asks only for its own opt-in | no spawn; message matches `allowUnsafePack`, not `allowUnsafeExec` | C3 | no | low |
| FUN::push permitted by that opt-in alone | spawn with `allowUnsafePack` | C3 | no | low |
| PRJ::parse-argv.spec.ts (5) | exact `ParsedArgv` shape for 5 forms | C2 (visible test) | maybe — a fix adding a public field to `ParsedArgv` fails; keep positionals internal | low |
| PRJ::parse-flags.spec.ts (11) | clusters, values; `clone -xu` stays opaque | C2 | no | low |
| PRJ::parse-paths.spec.ts (7) | `--` separator, pathspec unwrapping | C2 | no | low |
| PRJ::parse-config-read.spec.ts (10) | read detection and scopes | C2 | no | low |
| PRJ::parse-config-write.spec.ts (14) | write detection, scopes, key lowercasing (old rename-semantics case removed) | C2 | no | low |
| PRJ::parse-config-inline.spec.ts (8) | `-c`, `--config`, `--config-env` writes | C2 | no | low |
| PRJ::parse-env.spec.ts (20) | env→category map; legacy `'core.pager=cat'` yields only `allowUnsafeConfigEnvCount` | C2 (visible test) | maybe — a fix that also unpacks the legacy `'key=value'` spelling adds `allowUnsafePager` and fails | medium |
| PRJ::task-detection.spec.ts (7) | task identification, incl. rebase | C2 | no | low |
| PRJ::attack-vectors.spec.ts (8) | inline write collection; `clone -xu` yields no write | C2 | no | low |
| PRJ::vulnerability-analysis.spec.ts (many) | exact categories; `tar.command`→`allowUnsafeCommandBinaries`, `--exec-path`→`allowUnsafeExec` | C2 | no — a generic suffix rule must not add a second category (pass_alt dedupes) | low |
| PRJ::vulnerability-check.spec.ts (3) | combined env+argv categories | C2 | no | low |
| PRJ::simple-git rebase.spec.ts (3) | typed rebase argv | C2 | no | low |
| PRJ::clean.spec.ts (17) | clean argv incl. `-x`, `dfx`; mode errors | C2 | no | low |
| PRJ::push.spec.ts (many) | push argv and parsers | C2 | no | low |
| PRJ::rev-parse.spec.ts (3) | rev-parse argv | C2 | no | low |
| PRJ::config.spec.ts (many) | config list/get parsing | C2 | no | low |
| PRJ::plugin.unsafe.spec.ts (many) | existing refusals/opt-ins, incl. push `--exec`→`allowUnsafePack` | C2/C3 | no | low |
| PRJ::plugins.allow-environment.spec.ts (9) | env filter vs `allowEnvironment` layering | C2 | no | low |

## 2. Leniency (non-blocking)

- T1 — wrong fix: close only `trailer.command` (not `.cmd`), or only the positional route: caught by all 12 config SEC cases; `miss_t1.patch` fails as declared.
- T1/T4 — wrong fix: leave the packed environment unpacked: caught by the 5 packed SEC cases; `miss_t4.patch`.
- T2 — wrong fix: add a matcher but no per-command switch table: caught by `-qx`/`-ix`/`-qix`/`-x<cmd>`; `sf_row_only.patch`.
- T2 — wrong fix: task-agnostic or case-insensitive `-x`: caught by `FUN::clean -x -f`, `clean('dfx')`, `-X ours`; `ff_global_x.patch`, `ff_case_insensitive.patch`.
- T2 — wrong fix: match `--exec` only, not abbreviations: caught by both abbreviation SEC cases.
- T3 — wrong fix: keep the source section, or fix only the option spelling: caught by the 3 rename SEC cases; `miss_t3.patch`; refuse-all renames caught by the 2 ordinary-rename FUN cases.
- T4 — wrong fix: first entry only, or case-sensitive: caught by "among several", "mixed-case", "spaces and quotes".
- I1 — wrong fix: leave positionals off the check's path, or match only the typed method: caught by the 3 positional SEC cases; `miss_i1.patch`; `submodule status foreach` blocks matching any operand.
- I2 — wrong fix: match one filter switch: caught by the index/env-filter SEC cases; `miss_i2.patch`.
- Broad/global opt-in for every capability: caught by the four "only … opt-in" SEC cases.
- Refuse-all: caught by 184 functional failures; `ff_overbroad.patch`.
- **No test catches:** refusal after mutating repository or environment (contract unasserted); a non-"client" `Error` (any Error passes); key case-insensitivity in the *numbered* environment; the legacy packed `'key=value'` spelling (the visible parse-env row argues against parsing it); command-naming configuration keys outside the tested family (e.g. `core.alternateRefsCommand`, added only by `pass_hardening.patch`), so the wider property is untested; a task-agnostic `--*-filter` rule.

## 3. Hints

None: no sentence names a file, function, route, command, fix approach, trap, variant list or flaw count. "The library already refuses … unless the application has explicitly opted in" is the contract vocabulary the opt-in tests need, not a pointer.

## 3a. Required: generalize

none.

## Quality to tighten

1. Relax the pinned opt-in categories (the gate-a change above).
2. `parse-env.spec.ts`'s legacy `'core.pager=cat'` fixture conflicts with a fix that unpacks the same channel; adding a hidden legacy-spelling case would either fail the reference or need the visible row relaxed.
3. Assert the stated refusal contract: repository and environment unchanged (`invoke` discards both), and a client-error type rather than any `Error`.
4. Add a mixed-case key through the numbered environment (packed is covered).
5. Add a second command-naming configuration-key family beyond `trailer.*` (the hardening patch shows one).
6. Keep `positionals` out of the public `ParsedArgv` shape (or the visible shape test fails).

## 4. Realism

No flags. T1 is the advisory route; T2–T4 are real unmodified upstream code. I1/I2 are injected but ordinary typed methods in the surrounding style, reachable only through the public API. `filterBranch` wrapping a deprecated command is the weakest, but plausible.

## Verdict

**NOT READY (gate a).** The instruction never says which existing program opt-in governs a given capability; the hidden suites pin `allowUnsafeExec` for switch/operand routes and `allowUnsafeCommandBinaries` for configuration keys. A fix that refuses every such value before spawn but routes filters to `allowUnsafeFilter` and submodule operands to `allowUnsafeSubmodule` — both existing opt-ins, both keeping legitimate use working — fails `FUN::accepts a history-filter option when the caller opted into chosen programs` and `FUN::accepts a command run in each submodule when the caller opted into chosen programs` (reward 0). `build/git-js-s5/evidence/20261029T223601Z-trial-git-js-s5-mimo-r1-…` records exactly this. The four security "only … opt-in" cases and the trailer-config FUN case pin the mapping in the other direction.

Required changes: in `tests/functional/vulnerability-functional.spec.mts`, replace the hardcoded `unsafe` in the three "opted into chosen programs" cases with discovery — invoke, read the requested category from the error, assert it is an existing program opt-in, re-invoke with it enabled, `expectAllowed` (as the push case does); in `tests/security/vulnerability-security.spec.mts`, rewrite the four "only … opt-in" cases to enable a discovered-other category (or drop them). Alternative: one general instruction sentence mapping input kinds to opt-ins (configuration value → configuration command-binary opt-in; switch or operand → command-execution opt-in), naming no route.

Human review: confirm the repo's documented semantics make `allowUnsafeExec` the sole governing opt-in for switch/operand routes (if not, gate a stands), and whether the visible legacy packed-env fixture should be relaxed.

GATE_A: NOT_READY
NEEDS_HUMAN_REVIEW: YES
