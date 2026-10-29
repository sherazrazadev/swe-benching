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
