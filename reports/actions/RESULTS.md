# Accepted tasks: results

These tasks passed every step of the cwe-bench pipeline on GitHub Actions:

- **Build and gate.** The vulnerable code fails every security test, and the reference fix passes everything.
- **Trials.** Both DeepSeek and MiMo failed every counted run, so no run reached a full score.
- **Independent audits.** A Claude Opus audit of each failing run found it was the model's own failure, not a fault in the task.
- **Fairness review.** The review returned READY.

| Task | Weakness | Language | Project | DeepSeek | MiMo | Verdict |
|---|---|---|---|---|---|---|
| [`jenkins-s3`](#jenkins-s3) | CWE-502 (deserialization of untrusted data) | Java | [jenkinsci/jenkins](https://github.com/jenkinsci/jenkins) | 0.6, 0.6, 0.6 | 0, 0, 0, 0 (+1 excluded) | **ACCEPTED** |
| [`winter-s4`](#winter-s4) | CWE-693 (protection mechanism failure) | PHP | [wintercms/winter](https://github.com/wintercms/winter) | 0, 0, 0 | 0, 0, 0 | **ACCEPTED** |
| [`git-js-s5`](#git-js-s5) | CWE-184 (incomplete list of disallowed inputs) | TypeScript | [steveukx/git-js](https://github.com/steveukx/git-js) | 0.5185, 0.3704, 0.2593 | 0.3704, 0.2593, 0, 0 (+1 excluded) | **ACCEPTED** |

---

## `jenkins-s3`

### Where the task is

The task is in Harbor format in [`tasks/jenkins-s3/`](../../tasks/jenkins-s3/). Results and logs are on branch
[`runs/40414311131`](https://github.com/sherazrazadev/swe-benching/tree/runs/40414311131).

| Path | What it is |
|---|---|
| `task.toml` | Harbor task definition: separate-container verifier, no network for the agent or the verifier, 2 CPU / 4 GB, agent limit 7200 s |
| `instruction.md` | The only text the model sees |
| `environment/Dockerfile`, `environment/injection.patch` | Jenkins at the vulnerable commit, plus the three added classes described below |
| `solution/fix.patch`, `solution/solve.sh` | Reference fix (6 core files) |
| `tests/` (`test.sh`, `score.py`, `security/`, `functional/`, `harness/`) | Hidden verifier: JUnit 5 suites run against a real in-process Jenkins controller |

### The vulnerability

- **Advisory:** GHSA-g2xq-2v27-4rh3 / CVE-2026-53435.
- **Code:** vulnerable commit `38673e2`, upstream fix `d739f6a`.

Jenkins saves the settings of a job, view or agent by reading back an XML configuration document a user submits to its
`config.xml` endpoints, using XStream. The flaw comes in two parts:

1. **Wrong element types are kept.** A document can put an object into a setting collection that is not of the type
   the collection is declared to hold. Jenkins creates the object and keeps it.
2. **Internal objects are recreated.** The same document can make Jenkins recreate internal objects that only route
   requests or manage plugins. These are not configuration values at all, and the upstream advisory rates the impact
   up to impersonation and code execution.

The upstream fix only closes the reported route: describable lists in a view. **The task asks for the general
property instead**, on every configuration route.

### What the model is asked to do (`instruction.md`)

The instruction describes the symptom on a view and states two properties that must hold for every accepted
configuration document:

1. **Element types.** Every element of a setting collection must be an instance of the element type that collection is
   declared to hold, or it is not created or kept.
2. **Internal objects.** Objects that exist only to route or dispatch a request, or to describe, load or manage a plugin,
   are never recreated from submitted configuration, even under a field whose type would admit them.

**How a submission must be handled:**
- A refused submission gets a 4xx response, and nothing in it is applied.
- An accepted submission that drops a bad value still applies everything else.
- Legitimate configuration, including plugin-provided subtypes, empty collections and absent values, keeps working.

**What the model must not do:** look up the upstream fix, or special-case the example.

### What makes it hard: four routes beyond the reported one

The upstream fix does not cover these four routes. Each one is a distinct mechanism, so a fix that copies the reported
case misses it:

| Route | Where | Real or added | Security test(s) |
|---|---|---|---|
| T1 Copy-on-write job properties: the converter never receives the declared element type | `hudson/util/CopyOnWriteList.java` | Real upstream code, unmodified | `unrelatedTypeInJobPropertiesIsNotKept` |
| T2 Generic base class: the field is `DescribableList<T, …>`, and `T` must be resolved through the concrete subclass | `hudson/model/DescribableGroupViewProperty.java` | Added to the product (`injection.patch`) | `unrelatedTypeInGroupEntriesIsNotKept` |
| T3 Persisted list of plain settings, delegated to the copy-on-write converter with no element type | `hudson/model/ManagedSettingsProperty.java`, `ManagedSetting.java` | Added to the product (`injection.patch`) | `unrelatedTypeInPersistedSettingsIsNotKept` |
| T4 Request-routing and plugin objects reachable through an untyped field, which no element-type check can stop | `jenkins/security/ResourceDomainRootAction` (`Redirection`, `InternalResourceRequest`), `hudson/PluginWrapper` | Real upstream code, unmodified | `requestRedirectionIsNotRecreated`, `internalResourceRequestIsNotRecreated`, `pluginWrapperIsNotRecreated` |

T2 and T3 are three small classes added to Jenkins in the same style Jenkins already uses, so the task is
`source = "injected"`. T1 and T4 are unmodified upstream code.

### Tests and scoring

- **Security: 10 tests.** They cover view, job and agent properties, job build steps (including a type chosen through
  the `class` attribute), and the four routes above. Each test submits a document through the real HTTP endpoint,
  then checks two things: the response is not a server error, and the live object did not keep the bad value. Either
  allowed refusal passes, a 4xx with nothing applied, or a 2xx with the bad value dropped.
- **Functional: 14 tests.** These are 10 hidden tests that bind legitimate configuration through the same endpoints,
  plus the project's own `RobustReflectionConverterTest` cases for this area.
- **Reward.** The reward is 1.0 only when every security and functional test passes. If any functional test fails,
  the reward is 0. Otherwise it is the share of security tests passed.

### Validation before any model ran (the gate)

| Check | Expected | Result |
|---|---|---|
| Vulnerable code (no fix) | Every security test fails | ✅ |
| Reference fix | Everything passes | ✅ |
| Independent alternative fix at a different layer (`alt_correct_fix.patch`) | Everything passes | ✅ |
| Blind fix by a fresh agent (`blind.patch`) | Everything passes | ✅ |
| 6 incomplete fixes: upstream-only, missing copy-on-write, missing generic, missing persisted list, missing redirection, server error used as a refusal | Each is caught by a security test | ✅ |
| 2 over-broad fixes: reject every exact-class mismatch, or refuse the whole document | Each is caught by a functional test | ✅ |
| Hardening patch | Passes | ✅ |

The gate verdict is pass (2026-10-27T00:49Z).

### Model results

The trials were run on GitHub Actions in [run 40414311131](https://github.com/sherazrazadev/swe-benching/actions/runs/40414311131),
with extra MiMo runs in [run 40514107650](https://github.com/sherazrazadev/swe-benching/actions/runs/40514107650) and
[run 40539993851](https://github.com/sherazrazadev/swe-benching/actions/runs/40539993851).

| Model | Run | Reward | Agent time | Counted? | Why it failed (Opus audit) |
|---|---|---|---|---|---|
| DeepSeek | 1 | 0.6 | 96 min | ✅ | Passed 6 of 10 security tests and all functional tests. Missed generic `T` resolution (T2) and both routing objects (T4) |
| DeepSeek | 2 | 0.6 | 81 min | ✅ | Same 4 misses |
| DeepSeek | 3 | 0.6 | 103 min | ✅ | Same 4 misses; also blocked every `Plugin` subclass |
| MiMo | 1 | 0 | 75 min | ❌ excluded | The provider refused the request ("considered high risk") before MiMo made any edit, so the score says nothing about the model |
| MiMo | 2 | 0 | 2 h limit | ✅ | Left routing objects open and missed generic `T`; broke the project's own `RobustReflectionConverterTest` |
| MiMo | 3 | 0 | 2 h limit | ✅ | Debug switches left in the graded code; a new `updateByXml` path rejects every job configuration submission |
| MiMo | 4 | 0 | 2 h limit | ✅ | Wrote its code in the last 13 minutes and never ran a test. Never looked at the routing objects, and broke two of the project's own tests |
| MiMo | 5 | 0 | 96 min | ✅ | Broke two of the project's own tests and missed the routing objects and generic `T` |

**The common failure:** neither model found the routing objects in `ResourceDomainRootAction`, which is
T4. DeepSeek's audits say it never even looked at that class. No model resolved the generic type variable (T2) either.
Both models handled the routes that look like the reported one (T1 and T3), so the difficulty lies exactly in the two
mechanisms that differ from the reported case.

### Why this is fair

- **Fairness review: READY.** Property 1 covers every collection route, and property 2 covers the routing and plugin
  objects under an untyped field. The reference fix, the alternative fix and the blind fix all score 24/24. Tests
  accept both refusal forms the instruction allows, and no correct fix fails a test. The full review is in
  [`verdicts/jenkins-s3-FAIRNESS.md`](verdicts/jenkins-s3-FAIRNESS.md).
- **The review's two questions were decided KEEP.**
  1. "The type the collection is declared to hold" includes a type variable resolved through the concrete class.
  2. "Plugin-provided subtypes … are saved as before" means a legitimate `Plugin` entry must be kept.

  Neither question changes the outcome; see [`checks/jenkins-s3/HUMAN-DECISION.md`](checks/jenkins-s3/HUMAN-DECISION.md).
- **Audits: 7 of 8 failing runs are trustworthy model failures.** The 8th (MiMo run 1) was a provider refusal and is
  not counted. No audit found a test that fails a correct fix or a requirement missing from the instruction. No run
  read the hidden tests, looked up the upstream fix, or made tool calls during grading.
- **The task is real and solvable.** Three independent fixes reach 1.0, and every miss above is a requirement the
  instruction states.

### Caveats

- **`pluginWrapperIsNotRecreated` is debatable.** Two DeepSeek audits note the model blocked every `hudson.Plugin`
  subclass, which is a defensible reading of "objects that manage a plugin". On that reading, its fair score is 0.7
  rather than 0.6. The task stays unsolved either way, because T2 and the two routing objects are clear misses.
- **The MiMo runs used a 2-hour agent limit.** That is the task's `timeout_sec`. The cwe-bench guide runs trials at
  3 h (`CWE_AGENT_TIMEOUT_MULT=1.5`), and that setting has now been added to the GitHub trials. Runs 2–4 hit the
  2-hour limit and were graded on the code they had by then. Under the cwe-bench rule, a timeout counts as a failure
  once an independent audit confirms it, and all three were audited as genuine model failures. MiMo run 5 finished
  normally in 96 minutes and still failed. DeepSeek finished every run well inside the limit.

### Evidence

- Final verdict page: [`verdicts/jenkins-s3.md`](verdicts/jenkins-s3.md)
- Audit of each failing run: [`audits/jenkins-s3-*/POSTMORTEM.md`](audits/)
- Build, gate and trial records: branch [`runs/40414311131`](https://github.com/sherazrazadev/swe-benching/tree/runs/40414311131),
  `build/jenkins-s3/` (`gate_report.json`, `manifest.json`, `notes.md`, `trial_detail_*.json`)

---

## `winter-s4`

### Where the task is

The task is in Harbor format in [`tasks/winter-s4/`](../../tasks/winter-s4/). Results and logs are on branch
[`runs/40724061049`](https://github.com/sherazrazadev/swe-benching/tree/runs/40724061049).

| Path | What it is |
|---|---|
| `task.toml` | Harbor task definition: separate-container verifier, no network for the agent or the verifier, 2 CPU / 4 GB, agent limit 7200 s (run at 3 h in the trials, see below) |
| `instruction.md` | The only text the model sees |
| `environment/Dockerfile`, `environment/injection.patch`, `environment/composer.json`, `composer.lock` | Winter CMS at the vulnerable commit with its Composer dependencies, plus the two added helper methods described below |
| `solution/fix.patch`, `solution/solve.sh` | Reference fix (6 files under `modules/system/`) |
| `tests/` (`test.sh`, `score.py`, `security/`, `functional/`, `support/`, `Dockerfile`) | Hidden verifier: PHPUnit suites that render templates through the real CMS, run with the project's own PHPUnit |

The task came from the s4 lane: a candidate that passed step-2 screening but had not been used, built with sibling
injection (`source = "mined+injected"`).

### The vulnerability

- **Advisory:** GHSA-8CFW-PCWH-V63W / CVE-2026-79774.
- **Code:** vulnerable commit `598fd8b`, upstream fix `725bbcd`.

Winter CMS lets editors write pages, layouts and partials in Twig. With safe mode on, an editor cannot save PHP code,
and templates render inside a Twig sandbox. The sandbox decides what a template may call with a blocklist of method
names per class (`modules/system/twig/SecurityPolicy.php`). The flaw comes in three parts:

1. **Names are missing from the blocklist.** The reported page calls `this.theme.writeConfig(...)`, and the render
   writes the theme's configuration file. The function check (`checkSecurity`) exists but has an empty body.
2. **The check never sees arguments.** It gets only the object and the method name. A harmless-looking collection or
   paged-result method can run a PHP function that the template passes in as a callable.
3. **The checked object is not the one that acts.** Models forward unknown calls to query objects, and some helpers
   do the write inside PHP after the checked name has passed.

The upstream fix blocks the reported names, models some forwarding, and strips callables from collection and
paged-result arguments. **The task asks for the general property instead:** rendering a template never runs
arbitrary PHP, exposes host files or values, writes stored files or changes stored records.

### What the model is asked to do (`instruction.md`)

The instruction gives the reported page body and states one property: template content is untrusted input, and
rendering it must never

1. execute arbitrary PHP,
2. expose files or host values the template was not given,
3. create, modify or delete stored files, or
4. change stored records,

"whichever template is rendered and whatever values the application passes in or the template carries along".

**How a render must be handled:**
- A refused render is a plain client error (an error page or a template error) and leaves no side effect.
- Everything that works today keeps working exactly as today: settings and stored values still bind, loops,
  conditions, partials and built-in filters still render, lists and paged results still display, iterate and count,
  and callbacks written in the template still work.

**What the model must not do:** look up the upstream fix or the advisory, or special-case the example.

### What makes it hard: eight routes, three mechanisms

The report shows one theme-file write. A fix has to hold across every route below. Three of them stay open under the
published upstream fix (T3, T6, T7). The published fix also strips every callable argument, which breaks callbacks
written in a template, and the functional tests require those to keep working.

| Route | Where | Real or added | Security test(s) |
|---|---|---|---|
| T1 Theme configuration write: the reported example | `modules/cms/classes/Theme.php:525` (`writeConfig`) | Real upstream code, unmodified | `testThemeConfigurationCannotBeChangedByATemplate` |
| T2 String callable passed to a collection or paged-result method, by dot call and by the built-in `attribute()` helper | `modules/system/twig/SecurityPolicy.php:182-211` (`checkMethodAllowed` sees no arguments) | Real upstream code, unmodified | `testCollectionMethodDoesNotExecuteAStringCallableFromATemplate`, `testAttributeHelperDoesNotExecuteAStringCallable`, `testPagedResultsDoNotExecuteAStringCallableFromATemplate` |
| T3 Array-form callable (`['Class', 'method']`): a recursive stripper returns from the array branch before testing the array itself | `modules/system/twig/securitypolicy/SafeCollection.php` (reference fix) | Real upstream sink; the published fix leaves this gap | `testCollectionMethodDoesNotExecuteAnArrayCallableFromATemplate`, `testBuiltInAttributeHelperDoesNotExecuteAnArrayCallable` |
| T4 Page file overwritten through the page's query object: `this.page.newQuery().update(...)` | `SecurityPolicy.php:445-459`, `:268-274` | Real upstream code, unmodified | `testPageFileCannotBeOverwrittenThroughAQueryObject` |
| T5 Stored records changed through a quiet save, a forwarded counter, the query object, and a forwarded callable | `SecurityPolicy.php:95-150` | Real upstream code, unmodified | `testStoredRecordCannotBeChangedThroughAQuietSave`, `…ThroughAForwardedCounter`, `…ThroughAQueryObject`, `testForwardedModelMethodDoesNotExecuteAStringCallable` |
| T6 Theme setter `saveConfigValue` calls the blocked writer inside PHP | `modules/cms/classes/Theme.php:496` | Added to the product (`injection.patch`) | `testThemeConfigurationCannotBeChangedByATemplateThroughASetter` |
| T7 Page helper `saveAttributes` runs the query write inside PHP | `modules/cms/classes/CmsCompoundObject.php:92` | Added to the product (`injection.patch`) | `testPageFileCannotBeOverwrittenThroughASaveHelper` |
| T8 Host constant and stored template source read through `constant()` and `source()` | `SecurityPolicy.php:368-380` (`checkSecurity`) | Real upstream code, unmodified | `testHostConstantIsNotExposedToATemplate`, `testStoredTemplateSourceIsNotExposedToATemplate` |

T6 and T7 are two one-line helper methods added to Winter in the style of the methods next to them. They sit in files
the published fix never touches. Everything else is unmodified upstream code.

### Tests and scoring

- **Security: 15 tests in 11 files.** Each test renders an attack template through the real CMS front end
  (`Controller::run`) or the CMS Twig environment the application exposes (`Controller::getTwig`). It then checks
  that the side effect did not happen: no file created, changed or removed, no record changed, no host value or
  template source in the output. Any thrown error counts as a refusal.
- **Functional: 37 tests.** These are 10 hidden tests that render legitimate templates (settings, loops, filters,
  partials, collections, paged results, template callbacks, model reads, session use), plus the project's own 27
  tests in `modules/system/tests/twig`. The runner includes that whole directory (`tests/support/run.php:37-39`), so
  any test the agent leaves there is graded too.
- **Reward.** The reward is 1.0 only when every security and functional test passes. If any functional test fails,
  the reward is 0. Otherwise it is the share of security tests passed, capped at 0.99 (`tests/score.py:59-64`).

### Validation before any model ran (the gate)

| Check | Expected | Result |
|---|---|---|
| Vulnerable code (no fix) | Every security test fails, every functional test passes | ✅ 15 fail / 37 pass |
| Reference fix (3 runs) | Everything passes | ✅ 52/52 |
| Independent alternative fix, signature-based refusal (`pass_alt.patch`) | Everything passes | ✅ |
| Fix by a fresh agent (`blind.patch`, DeepSeek; it was given the instruction, tree, tests, reference and trap list) | Everything passes | ✅ 1.0 |
| 9 incomplete fixes: missing the reported write, the setter, the query object, the model writes, all callables, array callables, the page helper, the function surface, or reads-only | Each is caught by a security test | ✅ |
| 1 over-broad fix (`func_fail_overbroad.patch`) | Caught by a functional test | ✅ 6 functional failures |
| Hardening patch | Passes | ✅ |

The gate verdict is pass (2026-10-28T17:20:52Z). The fresh-agent fix was checked right after (17:22Z) and scored 1.0.

### Model results

The trials were run on GitHub Actions, batch 12, in
[run 40724061049](https://github.com/sherazrazadev/swe-benching/actions/runs/40724061049). The agent limit was 3 h
(`CWE_AGENT_TIMEOUT_MULT=1.5`). Every run finished on its own; none hit the limit.

| Model | Run | Reward | Agent time | Counted? | Why it failed (Opus audit) |
|---|---|---|---|---|---|
| DeepSeek | 1 | 0 | 45 min | ✅ | Passed all 15 security tests. Its deny-by-default allowlist broke 3 legitimate reads: `paginator.through(closure)`, `model.newQuery().count()` and `this.page.get()` |
| DeepSeek | 2 | 0 | 52 min | ✅ | Passed all 15 security tests. A deny-by-default policy blocked `newQuery` globally and refused `this.page.get()`, failing 2 functional tests |
| DeepSeek | 3 | 0 | 51 min | ✅ | Passed all 15 security tests. Its deny-by-default policy refused `model.newQuery().count()`, the only failing test |
| MiMo | 1 | 0 | 127 min | ✅ | Its callable guard covers a fixed list of method names that leaves out `through`, so `paginator.through('touch')` still runs PHP (14/15 security). It also blocked `newQuery`, breaking the model read |
| MiMo | 2 | 0 | 145 min | ✅ | Passed all 15 security tests. Its deny-by-default model policy refused `model.newQuery().count()`, the only failing test |
| MiMo | 3 | 0 | 66 min | ✅ | Changed only `SecurityPolicy.php` and never handled callable arguments; 6 security tests fail, including `constant()`. It also blocked `newQuery` and left 4 scratch tests in `modules/system/tests/twig` that now error |

Agent time is `duration_s` from `trial_detail_*.json`.

**The common failure:** every run broke the same legitimate read, `{{ model.newQuery().count() }}`
(`FunctionalModelReadsTest::testStoredValuesStillReadAndCount`). DeepSeek closed every security route in all three
runs, but each time with a deny-by-default policy that also blocked reads the instruction says must keep working.
The reference fix shows both can be done: it leaves `newQuery()` open and blocks only the writes on the query
objects. So the difficulty here is closing every route without breaking ordinary template use. MiMo runs 1 and 3 also
left security routes open (the paged-result callable, and in run 3 all callable arguments and `constant()`).

### Why this is fair

- **Fairness review: READY.** Every security test falls under one of the four stated rules, read literally. The
  routes the instruction does not name (array callables, forwarding, the added helpers) are instances of those rules
  or standard PHP knowledge. Four fixes reach 1.0: the reference, `pass_alt`, `pass_hardening` and `blind.patch`, so
  no single design is required. Tests accept any thrown error as a refusal and demand no error class. The full review
  is in [`verdicts/winter-s4-FAIRNESS.md`](verdicts/winter-s4-FAIRNESS.md).
- **The review left one question open for a human.** Are the application-supplied values (collections, paged
  results and models passed to `Controller::getTwig`) in scope under "whatever values the application passes in"?
  And is "never execute arbitrary PHP" meant to keep sandboxed template callbacks while refusing PHP callables?
  The six audits answered it: none found a test that demands something the instruction does not state, and the
  audits cite those exact sentences ("values the application supplies", "callbacks written in the template still
  work") when judging the failures.
- **Audits: 6 of 6 failing runs are trustworthy model failures** (3 high confidence, 3 medium). No audit found a
  harness error or a test that fails a correct fix. No run read the hidden tests, looked up the upstream fix, or made
  tool calls during grading.
- **The task is real and solvable.** Four different fixes reach 1.0, and every miss above breaks a rule or a
  "keeps working" promise the instruction states.

### Caveats

- **One functional test decides most of the zeros.** `testStoredValuesStillReadAndCount` failed in all six runs. It
  was the only failure in DeepSeek run 3 and MiMo run 2, so without it those two runs would score 1.0, and MiMo
  run 1 would score 0.93. The three medium-confidence audits (DeepSeek 3, MiMo 1, MiMo 2) say why: the instruction
  promises that reads keep working "exactly as today" but never names query objects, and blocking query objects is
  a defensible hardening choice. They still judged the test fair, because the read works at the pinned commit and
  the reference fix keeps it working. DeepSeek runs 1 and 2 and MiMo run 3 fail for other reasons as well.
- **The review's "Required: generalize" note was not applied.** It asked to reword the "keeps working" contract so
  it does not list the surfaces the callable routes use (lists, paged results, callbacks). The instruction the models
  saw still lists them. That makes the task slightly easier, not harder, so it does not weaken the zero scores.
- **Security tests check for missing side effects, not for an error.** The review notes that a fix that silently
  turns a dangerous call into a no-op would pass the security tests, although the instruction asks for an error.
  No run took that route, so the results are unaffected.
- **Agent tests count.** The functional group runs everything in `modules/system/tests/twig`. MiMo run 3 left scratch
  tests there that errored. The audit judged this fair, since the model saw the failures and kept the files.
- **The "fresh agent" fix was not blind.** The gate's `blind.patch` agent was given the tests and the reference fix.
  It still shows a second design reaching 1.0, next to the build's own `pass_alt.patch` and `pass_hardening.patch`.

### Evidence

- Final verdict page: [`verdicts/winter-s4.md`](verdicts/winter-s4.md)
- Fairness review: [`verdicts/winter-s4-FAIRNESS.md`](verdicts/winter-s4-FAIRNESS.md)
- Audit of each failing run: [`audits/winter-s4-*/POSTMORTEM.md`](audits/)
- Build, gate and trial records: branch [`runs/40724061049`](https://github.com/sherazrazadev/swe-benching/tree/runs/40724061049),
  `build/winter-s4/` (`gate_report.json`, `gate_verdict.json`, `manifest.json`, `notes.md`, `FAIRNESS.md`,
  `trial_detail_*.json`)

---

## `git-js-s5`

### Where the task is

The task is in Harbor format in [`tasks/git-js-s5/`](../../tasks/git-js-s5/). Results and logs are on branch
[`runs/40763748092`](https://github.com/sherazrazadev/swe-benching/tree/runs/40763748092), and the extra MiMo run is on
branch [`runs/40797199325`](https://github.com/sherazrazadev/swe-benching/tree/runs/40797199325), which also holds the
merged trial records, the fairness review and all seven audits.

| Path | What it is |
|---|---|
| `task.toml` | Harbor task definition: separate-container verifier, no network for the agent or the verifier, 2 CPU / 4 GB, agent limit 7200 s (run at 3 h in the trials, see below) |
| `instruction.md` | The only text the model sees |
| `environment/Dockerfile`, `environment/injection.patch` | git-js (`simple-git` plus `@simple-git/argv-parser`) at the vulnerable commit with its pnpm dependencies, plus the two added typed operations described below |
| `solution/fix.patch`, `solution/solve.sh` | Reference fix (7 files under `packages/argv-parser/src/`) |
| `tests/` (`test.sh`, `score.py`, `security/`, `functional/`, `runner/`, `support/`, `Dockerfile`) | Hidden verifier: vitest suites that drive the library's public API against a recording stand-in for `git`, plus the project's own tests for the area |

The task came from step 3, the s5 lane. On the colleague's VM scale run, the stacked task `stk-git-js-ghsa9p95` on the
same repo was solved by both models (`reports/scale-run/ledger.tsv`; those solves were counted but not audited).
`pipelines/router/step3_from_ledger.py` builds one sibling task for each repo whose stacked task a model solved, so it
sent steveukx/git-js to a sibling-injection build with lane suffix s5 (`source = "injected"`).

### The vulnerability

- **Advisory:** GHSA-X6JW-M9V5-85VH / CVE-2026-102828.
- **Code:** vulnerable commit `76f308e`, upstream fix `d762810`.

`simple-git` is a Node.js library that applications use to run `git`. Every call it builds goes through one guard
(`blockUnsafeOperationsPlugin`, then `vulnerabilityCheck`). The guard parses the argv and the task environment, and it
refuses anything that could make `git` run a program the caller names, unless the application has enabled the
matching `unsafe.*` opt-in. The guard is a denylist, and the flaw comes in three parts:

1. **Keys are missing from the list.** The reported call writes `trailer.<token>.command`, which a later
   history-reading operation runs as a program. The configuration-key denylist has no row for it.
2. **The parser does not see what `git` will do.** `rebase` has no entry in the per-command switch table, so the exec
   switch is never recognised inside `-qx` or in `-x<cmd>`. A section rename is reported under its source name, not
   the name it creates. The packed configuration environment (`GIT_CONFIG_PARAMETERS`) is never unpacked.
3. **The analysis never sees some inputs at all.** Positional operands never reach the vulnerability check, and the
   history-filter switches have no rows.

The upstream fix adds the trailer rows and a rebase exec rule with its switch table. **The task asks for the general
property instead:** no caller-supplied value may make `git` run a program of the caller's choosing, by any route.

### What the model is asked to do (`instruction.md`)

The instruction shows the reported call (`git.raw(['config', 'trailer.summary.command', value])`) and states one
property. For every invocation the library builds, a value supplied by the application's caller must never cause `git`
to run a program of the caller's choosing, "however the library passes that value to `git`", unless the application has
enabled the existing opt-in. Every such value is refused before `git` starts.

**How a call must be handled:**
- A refused call fails with a client error before `git` is started, and the repository and environment are unchanged.
- Everything that works today keeps working exactly as today. That includes configuration and options that do not name
  a program, values that sit beside a program-naming setting, the same switch used by another operation, and values
  passed as ordinary arguments rather than as settings.
- An operation that already has its own opt-in keeps asking for that same opt-in and no other.

**What the model must not do:** look up the upstream fix, or special-case the example. The instruction also says "the
example above is an example, not the full set" and asks for a fix of "the problem and its close variants".

### What makes it hard: six routes, three parts of the argument pipeline

The report shows one configuration key, and the obvious repair is two rows in the flat configuration denylist. That
repair closes only T1. The published upstream fix also closes T2, but leaves T3, T4, I1 and I2 open. The over-broad
repairs (a switch rule for every command, a case-insensitive rule, refusing every configuration write) break values
the functional tests require.

| Route | Where | Real or added | Security test(s) |
|---|---|---|---|
| T1 Trailer command keys missing from the configuration denylist, through positional, inline `-c`, clone `--config`, `--config-env` and the numbered environment: the reported example | `packages/argv-parser/src/vulnerabilities/detect-vulnerable-config-writes.ts:39-71` | Real upstream code, unmodified | 7 tests in `configuration` (long, short and deeper keys, and each channel) |
| T2 Rebase exec switch: no matcher, and no rebase entry in the switch table, so clusters and attached values stay opaque | `detect-vulnerable-flags.ts:65-79`, `packages/argv-parser/src/tokens/flag-specs.ts:43-102` | Real upstream code, unmodified | 8 tests in `command options` (`-x`, `--exec` separate and embedded, `--exe`, `-qx`, `-ix`, `-qix`, attached value) |
| T3 Section rename: the parser reports the source section as the written key, so the created name is never checked (`--rename-section` and the `rename-section` verb) | `packages/argv-parser/src/config/detect-config-action.ts:21-55` | Real upstream code, unmodified | 3 tests in `section rename` |
| T4 Packed configuration environment: mapped to an opt-in, but its keys never reach the key denylist | `packages/argv-parser/src/env/parse-env.ts:20-100` | Real upstream code, unmodified | 3 packed-environment tests in `configuration` |
| I1 `submoduleForeach(command)`: the command is a positional operand, and the analysis is never given positionals | `simple-git/src/git.mjs:202`, `args/parse-argv.ts:19-30`, `vulnerabilities/vulnerability-analysis.ts:7-45` | Added to the product (`injection.patch`) | 3 tests in `positional operands` (typed, raw argv, with `--recursive`) |
| I2 `filterBranch(options)`: the history-filter switches name programs and have no denylist rows | `simple-git/src/git.mjs:216`, `detect-vulnerable-flags.ts:65-79` | Added to the product (`injection.patch`) | 3 history-filter tests in `command options` (typed and raw argv) |

I1 and I2 are two typed operations added to `simple-git/src/git.mjs`, with their typings, in the style of the methods
next to them. They sit in files the published fix never touches. T1 to T4 are unmodified upstream code.

### Tests and scoring

- **Security: 27 tests** in `tests/security/vulnerability-security.spec.mts`. Each test makes a call through the public
  API (typed operations, `raw`, or `.env()`). The `git` binary is a recording stand-in passed through the library's own
  `binary` option. A test passes when no child process started and the call threw an `Error` (`expectRefused`,
  `tests/support/harness.mts`). It does not check an error class, a message or an opt-in category.
- **Functional: 319 tests in the gate.** These are 29 hidden legitimate-use tests, plus the project's own
  `argv-parser` suite and seven `simple-git` unit files for rebase, clean, push, rev-parse, config and the two guard
  plugins (`tests/runner/run-functional.sh`). The hidden tests cover trailer formatting keys, ordinary settings in
  every channel, ordinary renames, strategy and interactive rebase options, `clean -x`, the `--exec-path` getter,
  submodule status and summary, history rewrites without filters, and each opt-in. One project case that asserts the
  old rename behaviour is removed from the verifier copy, because a correct fix has to change it.
- **Reward.** The reward is 1.0 only when every security and functional test passes. If any functional test fails,
  the reward is 0. Otherwise it is the share of security tests passed, capped at 0.99 (`tests/score.py:59-64`).

### Validation before any model ran (the gate)

| Check | Expected | Result |
|---|---|---|
| Vulnerable code (no fix) | Every security test fails, every functional test passes | ✅ 27 fail / 319 pass |
| Reference fix (3 runs) | Everything passes | ✅ reward 1.0 each |
| Independent alternative fix: a suffix rule for command keys, the last operand as the rename destination, a split-based environment parser (`pass_alt.patch`) | Everything passes | ✅ 1.0 |
| Fix by a fresh agent (`blind.patch`, DeepSeek; it was given the instruction, tree, tests, reference and trap list) | Everything passes | ✅ 1.0 |
| 7 incomplete fixes: missing the trailer keys, the rebase switch, the rename destination, the packed environment, the submodule operand or the history filters, or a rebase row without the switch table | Each is caught by a security test | ✅ |
| 3 over-broad fixes: a case-insensitive switch rule, a switch rule for every command, refuse every configuration write | Each is caught by a functional test | ✅ 2, 4 and 184 functional failures |
| Hardening patch | Passes | ✅ 1.0 |

The gate verdict is pass (2026-10-28T21:12:51Z). The fresh-agent fix was checked right after (21:13Z) and scored 1.0.

### Model results

The trials were run on GitHub Actions, batch 13, in
[run 40763748092](https://github.com/sherazrazadev/swe-benching/actions/runs/40763748092), with extra MiMo runs in
[run 40797199325](https://github.com/sherazrazadev/swe-benching/actions/runs/40797199325) (run 4) and
[run 40839074746](https://github.com/sherazrazadev/swe-benching/actions/runs/40839074746) (run 5). The agent limit was 3 h
(`CWE_AGENT_TIMEOUT_MULT=1.5`). Every run finished on its own; none hit the limit.

| Model | Run | Reward | Agent time | Counted? | Why it failed (Opus audit) |
|---|---|---|---|---|---|
| DeepSeek | 1 | 0.5185 | 28 min | ✅ | Passed 14 of 27 security tests and all functional tests. Missed the packed environment, the rename destination, the exec switch in clusters and as `--exe`, and the submodule command. It reproduced the rename attack itself and left it open, and it wrote a packed-environment parser and then reverted it |
| DeepSeek | 2 | 0.3704 | 27 min | ✅ | Passed 10 of 27. Added configuration-key rows and checked rename destinations; never handled the packed environment, rebase exec, history filters or the submodule command |
| DeepSeek | 3 | 0.2593 | 17 min | ✅ | Passed 7 of 27. Only added configuration-key rows. Found the rebase, submodule and filter-branch man pages that mention a shell command, and did not act on them |
| MiMo | 1 | 0 | 46 min | ❌ not counted | Submitted no change, so the unmodified code was graded (0 of 27). The transcript ends on a tool result with no final message, and the auditor could not read the agent log, so it could not rule out an external stop. Attribution "unclear" |
| MiMo | 2 | 0.3704 | 91 min | ✅ | Passed 10 of 27. Configuration keys and rename destinations only; the transcript never mentions rebase, filter-branch, foreach or the packed environment, yet its summary claims every channel is guarded |
| MiMo | 3 | 0.2593 | 69 min | ✅ | Passed 7 of 27. Added many program-naming configuration keys and never examined any other channel |
| MiMo | 4 | 0 | 44 min | ✅ | Submitted no change (0 of 27). It confirmed the reported gap in a probe, deleted its one scratch test, and ended mid-investigation |
| MiMo | 5 | 0 | 52 min | ✅ | Submitted no change (0 of 27). Same pattern as run 4: 62 turns of investigation, then the MiMo provider ended the session (`stop_reason: repetition_truncation`) before any edit |

Agent time is `duration_s` from `trial_detail_*.json`. No functional test failed in any run, so every reward above is
the plain share of security tests passed.

**The common failure:** every run closed the reported trailer key, or nothing at all, and stopped there. Ten security
tests failed in all seven runs: the three packed-environment tests (T4), the exec switch as `--exe` and inside `-qx`,
`-ix` and `-qix` (T2), and the three submodule-command tests (I1). Only DeepSeek run 1 caught the plain rebase exec
switch or the history filters, and only DeepSeek run 2 and MiMo run 2 caught the rename destination. So the difficulty
lies in the routes that need a change to what the parser produces or what the analysis receives, not a new denylist
row.

### Why this is fair

- **Fairness review: READY.** All 27 security tests drive a caller value that makes `git` run a program, and check
  only that `git` was not started and an error was thrown. The required property covers configuration, switches, the
  environment and operands ("however the library passes that value"). Four fixes reach 1.0: the reference,
  `pass_alt`, `pass_hardening` and `blind.patch`. The full review is in
  [`verdicts/git-js-s5-FAIRNESS.md`](verdicts/git-js-s5-FAIRNESS.md).
- **The review left one question open for a human, in two parts.**
  1. Could "Values passed as ordinary arguments rather than as settings keep working" be read as excluding the
     submodule command, which is a positional operand (I1)?
  2. Should the project's own `parse-env.spec.ts` assertion on the legacy packed-environment spelling be relaxed?

  The audits answered both. On (1), the DeepSeek run 2 and MiMo run 2 audits quote that sentence. They find it
  affects only the 3 submodule tests, while every run also failed at least 10 other tests that are clearly in scope.
  Without those 3 tests the best run would score 14/24 (0.58). On (2), only DeepSeek run 1 hit the assertion: its
  parser also decoded the legacy `'key=value'` form, the project test failed, and the model reverted the whole parser
  instead of narrowing it. The audit judged this a genuine failure, because a parser for the quoted `'key'='value'` form
  passes (the reference, `pass_alt` and `blind.patch` all do). It suggests relaxing the test as hygiene.
- **Audits: 6 of 7 failing runs are trustworthy model failures** (4 high confidence, 2 medium). The 7th (MiMo run 1)
  is "unclear": it submitted nothing, and the auditor could not read the agent log to tell a model stop from a provider
  or harness stop. It is not counted, and a 4th MiMo run was added in its place. That run also scored 0 and was audited
  as a model failure with high confidence. No audit found a harness error or a test that fails a correct fix. No run
  read the hidden tests, looked up the upstream fix, or made tool calls during grading.
- **The task is real and solvable.** Four different fixes reach 1.0, and every miss above is a route the instruction's
  property covers.

### Caveats

- **Ten tests fail in every run, but no single test decides a score.** The ten tests named under "The common failure"
  failed in all seven runs. Neither 0 depends on any one test: both MiMo zeros are empty submissions that fail all 27
  security tests and pass every functional test. No functional test failed in any run.
- **Three of MiMo's five runs ended by the provider's repetition cut-off, with no edits.** The agent logs of runs 4
  and 5 end with `stop_reason: repetition_truncation` (the MiMo API stopped output it judged repetitive) after
  59 and 62 turns; run 1 looks the same, but its log could not be read. The owner decided to count these as MiMo's
  own failures: the loop happens consistently on this task, and MiMo's two complete attempts score only 0.3704 and
  0.2593. A fifth MiMo run was added specifically to check this, and it ended the same way.
- **MiMo runs 1 and 4 look the same but were judged differently.** Both submitted no change, ended on a tool result
  after about 45 minutes, and left an agent log the auditor could not read. Run 1 was marked "unclear" and run 4 a
  model failure (high confidence). `trial_detail_mimo.json` records both as `finish: success` with no error, which
  suggests the model stopped by itself. Even if both are set aside, MiMo's two remaining runs score 0.3704 and 0.2593.
- **The review's "Required: generalize" notes were not applied.** The instruction the models saw still names the
  trailer key and the "later history-reading operation", and it still has the "ordinary arguments" sentence behind
  question (1). Naming the example makes the task slightly easier. The sentence could make I1 look out of scope, which
  is why its effect on the scores is stated above.
- **The tests are lenient in places.** The opt-in functional tests enable both relevant opt-ins, so the category a fix
  asks for is not checked. The review also lists cases no test catches: mixed-case packed keys, `--ex`, a crash used as
  a refusal, and a change to the repository before refusal. None of this can lower a score.
- **The tests observe the guard, not real `git`.** A recording stand-in shows whether a child process started. The
  build notes say they did not check that real `git` would run the program for every shape. The property the task
  states is "refused before `git` is started", which is what the tests check.
- **Two DeepSeek runs searched for the answers.** The audits of DeepSeek runs 1 and 3 record filesystem searches for
  hidden tests, fix references and package tarballs. They found nothing (the hidden tests are locked root-only), so the
  scores are unaffected.
- **The "fresh agent" fix was not blind.** The gate's `blind.patch` agent was given the tests and the reference fix.
  It still shows a second design reaching 1.0, next to the build's own `pass_alt.patch` and `pass_hardening.patch`.

### Evidence

- Final verdict page: [`verdicts/git-js-s5.md`](verdicts/git-js-s5.md)
- Fairness review: [`verdicts/git-js-s5-FAIRNESS.md`](verdicts/git-js-s5-FAIRNESS.md)
- Audit of each failing run: [`audits/git-js-s5-*/POSTMORTEM.md`](audits/)
- Build, gate and trial records: branch [`runs/40763748092`](https://github.com/sherazrazadev/swe-benching/tree/runs/40763748092)
  and, with the MiMo run 4 and run 5 records merged in, branches [`runs/40839074746`](https://github.com/sherazrazadev/swe-benching/tree/runs/40839074746) and
  [`runs/40797199325`](https://github.com/sherazrazadev/swe-benching/tree/runs/40797199325), `build/git-js-s5/`
  (`gate_report.json`, `gate_verdict.json`, `manifest.json`, `notes.md`, `FAIRNESS.md`, `trial_detail_*.json`, `audits/`)
