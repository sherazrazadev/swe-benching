# Accepted tasks: results

These tasks passed every step of the cwe-bench pipeline on GitHub Actions:

- **Build and gate.** The vulnerable code fails every security test, and the reference fix passes everything.
- **Trials.** Both DeepSeek and MiMo failed every counted run, so no run reached a full score.
- **Independent audits.** A Claude Opus audit of each failing run found it was the model's own failure, not a fault in the task.
- **Fairness review.** The review returned READY.

| Task | Weakness | Language | Project | DeepSeek | MiMo | Verdict |
|---|---|---|---|---|---|---|
| [`jenkins-s3`](#jenkins-s3) | CWE-502 (deserialization of untrusted data) | Java | [jenkinsci/jenkins](https://github.com/jenkinsci/jenkins) | 0.6, 0.6, 0.6 | 0, 0, 0, 0 (+1 excluded) | **ACCEPTED** |
| [`winter-s4`](#winter-s4) | CWE-693 (protection mechanism failure) | PHP | [wintercms/winter](https://github.com/wintercms/winter) | 0.8235, 0, 0 | 0, 0, 0 (runs 4–5 are 3 h timeouts; +2 not counted) | **ACCEPTED** (repaired version) |
| [`git-js-s5`](#git-js-s5) | CWE-184 (incomplete list of disallowed inputs) | TypeScript | [steveukx/git-js](https://github.com/steveukx/git-js) | 0.5185, 0.3704, 0.2593 | 0.3704, 0.2593, 0, 0 (+1 excluded) | **IN REPAIR** (blind check found a fairness fault; re-trial running) |
| [`izpack-zip-path-inj`](#izpack-zip-path-inj) | CWE-22 (path traversal) | Java | [izpack/izpack](https://github.com/izpack/izpack) | 0, 0.5882, 0.7059 | 0.4118, 0.4706, 0.4706 (+1 cut by rate limit, re-run) | **IN REPAIR** (blind check found a fairness fault; re-trial running) |

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

The task is in Harbor format in [`tasks/winter-s4/`](../../tasks/winter-s4/). This section describes the **repaired**
version (see "How it was repaired" below). Its results and logs are on branch
[`runs/40966617100`](https://github.com/sherazrazadev/swe-benching/tree/runs/40966617100). The first six runs of the
repaired version are also on [`runs/40944097095`](https://github.com/sherazrazadev/swe-benching/tree/runs/40944097095).
The original version and its six runs are on [`runs/40724061049`](https://github.com/sherazrazadev/swe-benching/tree/runs/40724061049)
and in `build/winter-s4/round0/`.

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

1. **Names are missing from the blocklist.** A page can call `this.theme.writeConfig(...)`, and the render writes the
   theme's configuration file. The function check (`checkSecurity`) exists but has an empty body.
2. **The check never sees arguments.** It gets only the object and the method name. A harmless-looking collection or
   paged-result method can run a PHP function that the template passes in as a callable.
3. **The checked object is not the one that acts.** Models forward unknown calls to query objects, and some helpers
   do the write inside PHP after the checked name has passed.

The upstream fix blocks the reported names, models some forwarding, and strips callables from collection and
paged-result arguments. **The task asks for the general property instead:** rendering a template never runs
arbitrary PHP, exposes host files or values, writes stored files or changes stored records.

### What the model is asked to do (`instruction.md`)

The instruction describes the incident in outcome terms only: with safe mode on, a page-only account stored a page
body, and the next render wrote an attacker-chosen value into the theme's configuration file. It no longer shows the
template code or names the method. It then states one property: template content is untrusted input, and rendering it
must never

1. execute arbitrary PHP,
2. expose files or host values the template was not given,
3. create, modify or delete stored files, or
4. change stored records,

"whichever template is rendered and whatever values the application passes in or the template carries along".

**How a render must be handled:**
- A refused render is a plain client error (an error page or an error raised while the template is processed) and
  leaves no side effect.
- Everything that works today keeps working exactly as today, for every value the application supplies: settings and
  stored values still bind; **stored records can still be read and counted, including when a template reads or counts
  them through the model it was given**; loops, conditions, partials and the built-in filters still render; lists and
  paged results still display, iterate and count; and callbacks written in the template still work.

**What the model must not do:** look up the upstream fix or the advisory, or special-case the incident.

### How it was repaired

The original version was accepted on 2026-10-28, but a later blind check showed it was unfair.

- **What was wrong.** One functional test, `FunctionalModelReadsTest::testStoredValuesStillReadAndCount`, renders
  `{{ model.newQuery().count() }}` and requires `1`. The original instruction never said that reads through a model's
  query object must keep working. It said only that "settings and stored values still bind" and that lists and paged
  results still count. The project's own policy already blocks `getQuery` on models, so blocking `newQuery` too is the
  natural maintainer choice. All six original runs and a blind Claude Opus fix failed this test. Because any functional
  failure sets the reward to 0, that one unstated rule turned otherwise-secure fixes into 0
  (`round0/AUDIT-FINDINGS.md`).
- **What changed in the instruction.** The keep-list now says that stored records can still be read and counted,
  including through the model a template is given. Every other keep-list item was kept word for word. (An earlier
  repair attempt had replaced the whole list with one generic line; that was rejected, because the generic line is
  what caused the unfairness.) The incident no longer shows the code `this.theme.writeConfig(...)`, so the instruction
  does not point at a location.
- **What changed in the tests.** Security went from 15 to 17 tests: `source()` is now also tested with a file name
  written into the template (no getter), and `enum_cases()` is covered. One test per mechanism (theme write, string
  callable, array callable, quiet save, host constant) now also requires the render to fail with an error. Functional went from 37 to 38 tests: a theme configuration read was added, and a
  legitimate `attribute(items, 'pluck', ['n'])` call was added to an existing test. The over-broad wrong fix
  (`func_fail_overbroad.patch`) was regenerated so it refuses every method call.
- **Then the task was re-gated and re-trialled** with fresh DeepSeek and MiMo runs (below).

### What makes it hard: eight routes, three mechanisms

The report shows one theme-file write. A fix has to hold across every route below. Three of them stay open under the
published upstream fix (T3, T6, T7). The published fix also strips every callable argument, which breaks callbacks
written in a template, and the functional tests require those to keep working.

| Route | Where | Real or added | Security test(s) |
|---|---|---|---|
| T1 Theme configuration write: the reported incident | `modules/cms/classes/Theme.php:525` (`writeConfig`) | Real upstream code, unmodified | `testThemeConfigurationCannotBeChangedByATemplate` |
| T2 String callable passed to a collection or paged-result method, by dot call and by the built-in `attribute()` helper | `modules/system/twig/SecurityPolicy.php:182-211` (`checkMethodAllowed` sees no arguments) | Real upstream code, unmodified | `testCollectionMethodDoesNotExecuteAStringCallableFromATemplate`, `testAttributeHelperDoesNotExecuteAStringCallable`, `testPagedResultsDoNotExecuteAStringCallableFromATemplate` |
| T3 Array-form callable (`['Class', 'method']`): a recursive stripper returns from the array branch before testing the array itself | `modules/system/twig/securitypolicy/SafeCollection.php` (reference fix) | Real upstream sink; the published fix leaves this gap | `testCollectionMethodDoesNotExecuteAnArrayCallableFromATemplate`, `testBuiltInAttributeHelperDoesNotExecuteAnArrayCallable` |
| T4 Page file overwritten through the page's query object: `this.page.newQuery().update(...)` | `SecurityPolicy.php:445-459`, `:268-274` | Real upstream code, unmodified | `testPageFileCannotBeOverwrittenThroughAQueryObject` |
| T5 Stored records changed through a quiet save, a forwarded counter, the query object, and a forwarded callable | `SecurityPolicy.php:95-150` | Real upstream code, unmodified | `testStoredRecordCannotBeChangedThroughAQuietSave`, `…ThroughAForwardedCounter`, `…ThroughAQueryObject`, `testForwardedModelMethodDoesNotExecuteAStringCallable` |
| T6 Theme setter `saveConfigValue` calls the blocked writer inside PHP | `modules/cms/classes/Theme.php:496` | Added to the product (`injection.patch`) | `testThemeConfigurationCannotBeChangedByATemplateThroughASetter` |
| T7 Page helper `saveAttributes` runs the query write inside PHP | `modules/cms/classes/CmsCompoundObject.php:92` | Added to the product (`injection.patch`) | `testPageFileCannotBeOverwrittenThroughASaveHelper` |
| T8 Host constant, host enum cases and stored template source read through `constant()`, `enum_cases()` and `source()` | `SecurityPolicy.php:368-380` (`checkSecurity`) | Real upstream code, unmodified | `testHostConstantIsNotExposedToATemplate`, `testEnumCasesAreNotExposedToATemplate`, `testStoredTemplateSourceIsNotExposedToATemplate`, `testStoredTemplateSourceIsNotExposedWithoutAGetter` |

T6 and T7 are two one-line helper methods added to Winter in the style of the methods next to them. They sit in files
the published fix never touches. Everything else is unmodified upstream code.

### Tests and scoring

- **Security: 17 tests in 11 files.** Each test renders an attack template through the real CMS front end
  (`Controller::run`) or the CMS Twig environment the application exposes (`Controller::getTwig`). It then checks
  that the side effect did not happen: no file created, changed or removed, no record changed, no host value or
  template source in the output. Six of them (theme write, string callable on a collection, both array-callable
  tests, quiet save, host constant) also require the render to fail with an error. Any thrown error counts; no error
  class is required.
- **Functional: 38 tests.** These are 11 hidden tests that render legitimate templates (settings, loops, filters,
  partials, collections, paged results, template callbacks, model reads, theme reads, session use), plus the project's
  own 27 tests in `modules/system/tests/twig`. The runner includes that whole directory (`tests/support/run.php:37-39`),
  so any test the agent leaves there is graded too.
- **Reward.** The reward is 1.0 only when every security and functional test passes. If any functional test fails,
  the reward is 0. Otherwise it is the share of security tests passed, capped at 0.99 (`tests/score.py:59-64`).

### Validation before any model ran (the gate)

The repaired version was re-gated with every stage run again.

| Check | Expected | Result |
|---|---|---|
| Vulnerable code (no fix) | Every security test fails, every functional test passes | ✅ 17 fail / 38 pass |
| Reference fix (3 runs) | Everything passes | ✅ 55/55, identical across runs |
| Independent alternative fix, signature-based refusal (`pass_alt.patch`) | Everything passes | ✅ 1.0 |
| Hardening patch (`pass_hardening.patch`) | Everything passes | ✅ 1.0 |
| Fix by a fresh agent (`blind.patch`, DeepSeek; it was given the instruction, tree, tests, reference and trap list) | Everything passes | ✅ 1.0 |
| 9 incomplete fixes: missing the reported write, the setter, the query object, the model writes, all callables, array callables, the page helper, the function surface, or reads-only | Each is caught by a security test | ✅ rewards 0.2353 to 0.9412 |
| 1 over-broad fix that refuses every method call (`func_fail_overbroad.patch`) | Caught by a functional test | ✅ reward 0, 13 functional failures (10 hidden, 3 project) |

The gate verdict is pass (2026-10-29T20:26:47Z).

### Model results

The repaired version was trialled on GitHub Actions in
[run 40944097095](https://github.com/sherazrazadev/swe-benching/actions/runs/40944097095) (DeepSeek runs 1–3, MiMo
runs 1–3). Two more MiMo runs were added in the verdict run
[run 40966617100](https://github.com/sherazrazadev/swe-benching/actions/runs/40966617100) (runs 4 and 5), because
MiMo runs 2 and 3 could not be counted. The agent limit was 3 h (`CWE_AGENT_TIMEOUT_MULT=1.5`).

| Model | Run | Reward | Agent time | Counted? | Why it failed (Opus audit) |
|---|---|---|---|---|---|
| DeepSeek | 1 | 0.8235 | 33 min | ✅ | Passed 14 of 17 security tests and all 38 functional tests. Hardened methods, forwarding and callable arguments in depth, but left the function check empty, so `constant()`, `enum_cases()` and `source()` with a written-in file name still work |
| DeepSeek | 2 | 0 | 37 min | ✅ | Passed all 17 security tests. Rewrote the policy as a strict allowlist that broke 5 functional tests: template callbacks on collections and paged results, `where`/`sortBy`/`groupBy`, `model.newQuery().count()`, and iterating theme pages with `this.page.get()` |
| DeepSeek | 3 | 0 | 45 min | ✅ | Passed all 17 security tests. Same allowlist approach; broke 4 functional tests (template callbacks on collections and paged results, `where`/`sortBy`/`groupBy`, `model.newQuery().count()`). The transcript shows the model chose to refuse `map(...)` on purpose |
| MiMo | 1 | 0 | 50 min | ✅ | Submitted no source change (0 of 17). Investigation only; the transcript ends on a tool result with no final message. Audited "model-failed", medium confidence |
| MiMo | 2 | 0 | 40 min | ❌ not counted | Submitted no product change, only two scratch tests. The transcript stops abruptly and the auditor could not read the agent log to tell a model stop from a provider stop. Attribution "unclear" |
| MiMo | 3 | 0 | 1 min | ❌ excluded | The provider refused the request ("considered high risk") after 8 read-only calls, before any edit |
| MiMo | 4 | 0 | 3 h limit | ✅ | Hit the 3-hour limit. Passed 7 of 17 security tests per the audit. Blocked method names but never handled callable arguments (`each('touch')`, `each([File,'delete'])`, `through('touch')`, `model.each('var_dump')`), left the page save helper and `enum_cases()` open, and blocked `newQuery`, breaking the model read |
| MiMo | 5 | 0 | 3 h limit | ✅ | Hit the 3-hour limit. Fixed the incident and all file and record writes, but its allowlist permits `each`/`map`/`filter` and nothing strips non-closure callables, so 5 callable tests fail. Also left `enum_cases()` open and broke the legitimate `paginator.through(closure)` callback |

Agent time is `duration_s` from `trial_detail_*.json`; runs 4 and 5 have no `duration_s` and ended at the 10800 s
limit.

**The common failure:** the models fell on one side or the other of the same line. DeepSeek runs 2 and 3 closed every
security route, but with allowlists that also blocked reads and template callbacks the instruction now names
explicitly. MiMo runs 4 and 5 kept ordinary use mostly working, but never stopped a template from passing a PHP
function as a callable argument. DeepSeek run 1 came closest: it handled both, and missed only the function surface
(T8). `testEnumCasesAreNotExposedToATemplate` failed in every run that changed code except DeepSeek runs 2 and 3. The
reference fix shows both sides can be met: it strips string and array callables but keeps template closures, and it
leaves `newQuery()` open while blocking the writes on the query objects.

### Why this is fair

- **Fairness review: READY.** Every security test falls under one of the four stated rules, read literally. Every
  functional test rests on a keep-list sentence the instruction states, including the new "stored records can still
  be read and counted" line. Four fixes reach 1.0: the reference, `pass_alt`, `pass_hardening` and `blind.patch`, so
  no single design is required. Tests accept any thrown error as a refusal and demand no error class. The full review
  is in [`verdicts/winter-s4-FAIRNESS.md`](verdicts/winter-s4-FAIRNESS.md).
- **Blind check of the repaired version: Claude Opus scored 0.3529, and passed every functional test.**
  In [run 40965701205](https://github.com/sherazrazadev/swe-benching/actions/runs/40965701205), Claude Opus fixed the
  task with only `instruction.md` and the repository (no shell, no tests, no web). Its fix passed all functional tests,
  so the keep-list now covers everything the functional suite checks. It missed 11 of 17 security tests, all inside
  the stated bug: string and array callables (`testAttributeHelperDoesNotExecuteAStringCallable`,
  `testBuiltInAttributeHelperDoesNotExecuteAnArrayCallable`,
  `testCollectionMethodDoesNotExecuteAnArrayCallableFromATemplate`,
  `testCollectionMethodDoesNotExecuteAStringCallableFromATemplate`,
  `testPagedResultsDoNotExecuteAStringCallableFromATemplate`, `testForwardedModelMethodDoesNotExecuteAStringCallable`),
  host values and template source (`testEnumCasesAreNotExposedToATemplate`, `testHostConstantIsNotExposedToATemplate`,
  `testStoredTemplateSourceIsNotExposedToATemplate`, `testStoredTemplateSourceIsNotExposedWithoutAGetter`), and the
  page save helper (`testPageFileCannotBeOverwrittenThroughASaveHelper`). For comparison, the same check on the
  original version scored 0, because of the `newQuery` functional test.
- **The review's open questions were decided KEEP** (2026-10-30, `build/winter-s4/HUMAN-DECISION.md`):
  1. A template the application builds at runtime (`Controller::getTwig()` + `createTemplate`) is covered by
     "whichever template is rendered".
  2. For a template rendered directly, an error raised during processing is the natural refusal. The error checks
     accept any `Throwable`.
  3. The repaired instruction keeps the full keep-list, and the blind Opus fix passing every functional test shows the
     functional suite is covered by it.
- **Audits: 6 of 8 failing runs are trustworthy model failures** (5 high confidence, 1 medium). MiMo run 2 was
  "unclear" and MiMo run 3 was a provider refusal; neither is counted. No audit found a harness error or a test that
  fails a correct fix. No run read the hidden tests, looked up the upstream fix, or made tool calls during grading.
- **The task is real and solvable.** Four different fixes reach 1.0, and every miss above breaks a rule or a
  "keeps working" promise the instruction states.

### Caveats

- **DeepSeek run 1 was a near miss.** It scored 0.8235 (14/17) with every functional test passing, and missed only
  the function surface. One of its three misses is `enum_cases()`. The MiMo run 2 audit notes that whether host enum
  cases count as a "host value" is a matter of interpretation. Even without that test, run 1 would still fail
  `constant()` and `source()`, so it would not reach 1.0.
- **The scoring gate decides two DeepSeek zeros.** DeepSeek runs 2 and 3 passed all 17 security tests and scored 0
  only because they broke legitimate reads and callbacks. Any functional failure sets the reward to 0. This time every
  broken behaviour is named in the instruction's keep-list, and the audits quote those sentences, so these are fair
  zeros, but they are zeros for over-blocking, not for leaving the bug open.
- **No MiMo run finished a fix within the time limit.** Of the three counted MiMo runs, run 1 submitted no change, and
  runs 4 and 5 hit the 3-hour limit and were graded on the code they had. Under the cwe-bench rule
  (`common/audit/audit_results.py`), a 3-hour timeout counts as a failure once an audit confirms it, and both were
  audited as genuine model failures with high confidence. If timeouts were not counted, MiMo would have only one
  counted run, and that run made no edit. MiMo run 1's audit is also only medium confidence: its transcript ends on a
  tool result, much like run 2, which was not counted.
- **The review's "Required: generalize" note was not applied.** It asked to collapse the keep-list to generic wording.
  The repair followed the blind-check findings instead, which forbid shortening the list, because the generic wording
  is what made the original unfair. The instruction still lists the surfaces the callable routes use (lists, paged
  results, callbacks), which makes the task slightly easier, not harder.
- **Some wrong fixes are not caught.** The review lists leniency gaps: the security tests without an error check only
  look for the missing side effect, so a fix that silently turns a dangerous call into a no-op passes them; only the `each`
  executor is driven on models; and no functional test reads through the page's own query object. None of these can
  lower a score.
- **Agent tests count.** The functional group runs everything in `modules/system/tests/twig`. A model that leaves
  failing scratch tests there is scored 0. MiMo run 2 left two scratch tests, but it also made no product change.
- **The gate's "fresh agent" fix was not blind.** The `blind.patch` agent was given the tests and the reference fix.
  The real blind check is the Claude Opus run above.

### Evidence

- Final verdict page: [`verdicts/winter-s4.md`](verdicts/winter-s4.md)
- Fairness review: [`verdicts/winter-s4-FAIRNESS.md`](verdicts/winter-s4-FAIRNESS.md)
- Audit of each failing run: [`audits/winter-s4-*-202610{29,30}-*/POSTMORTEM.md`](audits/) (the `20261028` folders
  are the original version)
- Repair: `build/winter-s4/round0/AUDIT-FINDINGS.md` (what was unfair), `build/winter-s4/notes.md` ("Fairness
  revision"), `build/winter-s4/HUMAN-DECISION.md` (KEEP)
- Blind check of the repaired version: [run 40965701205](https://github.com/sherazrazadev/swe-benching/actions/runs/40965701205)
- Build, gate and trial records: branch [`runs/40966617100`](https://github.com/sherazrazadev/swe-benching/tree/runs/40966617100),
  `build/winter-s4/` (`gate_report.json`, `gate_verdict.json`, `manifest.json`, `notes.md`, `FAIRNESS.md`,
  `trial_detail_*.json`, `round0/` for the original version)

---

## `git-js-s5`

> **Status (2026-10-30): IN REPAIR.** A blind solvability check found a fairness fault in this version (see the repair runs); the task is being repaired and re-trialled. The results below describe the earlier version and are not final.

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

---

## `izpack-zip-path-inj`

> **Status (2026-10-30): IN REPAIR.** A blind solvability check found a fairness fault in this version (see the repair runs); the task is being repaired and re-trialled. The results below describe the earlier version and are not final.

### Where the task is

The task is in Harbor format in [`tasks/izpack-zip-path-inj/`](../../tasks/izpack-zip-path-inj/). The final version and
its results and logs are on branch
[`runs/40833539592`](https://github.com/sherazrazadev/swe-benching/tree/runs/40833539592) (repair run 2). That branch also
keeps the audits and fairness reviews of the two earlier rounds under `build/izpack-zip-path-inj/round0/` and `round1/`.
The first build and its trials are on branch
[`runs/40647352109`](https://github.com/sherazrazadev/swe-benching/tree/runs/40647352109) (batch 10).

| Path | What it is |
|---|---|
| `task.toml` | Harbor task definition: separate-container verifier, no network for the agent or the verifier, 2 CPU / 4 GB, agent limit 7200 s (run at 3 h in the trials, see below) |
| `instruction.md` | The only text the model sees |
| `environment/Dockerfile`, `environment/injection.patch` | IzPack at the vulnerable commit with its Maven cache warmed, plus the two added sibling code paths described below |
| `solution/fix.patch`, `solution/solve.sh` | Reference fix (10 files in `izpack-api`, `izpack-installer`, `izpack-tools` and `izpack-util`) |
| `tests/` (`test.sh`, `score.py`, `security/`, `functional/`, `project/`, `support/`, `harness/`, `Dockerfile`) | Hidden verifier: JUnit suites run with Maven offline as the unprivileged `agent` user. They drive the real installer classes over crafted installer metadata, plus the project's own unpacker tests |

The task was built in batch 10 with sibling injection (`source = "injected"`). Model trials then made it harder in two
steps, described under "How it was made harder" below.

### The vulnerability

- **Advisory:** GHSA-F63G-88CJ-HJF9 / CVE-2026-54550 (CWE-22, path traversal).
- **Code:** vulnerable commit `e431c89`, upstream fix `4233ba3`. The pinned commit is the fix's direct parent.

IzPack builds self-contained Java installers. A project description lists packs, and each entry in a pack declares the
location it is installed to. The compiler packs that information into the installer as serialised metadata
(`packs.info`). When the installer runs on a user's machine, it reads the metadata, substitutes configured values
(`${VAR}`) into each location, then creates directories and writes files there. The flaw: a location containing a
parent-directory segment (`..`) is used as it is, so a crafted installer writes outside the installation directory the
user chose.

The upstream fix adds one check, used in two places: the install-time write (`UnpackerBase`) and the public file-entry
constructor (`PackFile`). Other code paths that take a location from the same metadata stay open. **The task asks for
the general property instead:** no location value the toolkit accepts, however it arrives, may be used to create,
write, move, rename, rewrite or delete anything if it contains `..`.

### What the model is asked to do (`instruction.md`)

The instruction describes the observed impact (a file created outside the chosen installation directory) and states
three properties:

1. **No traversing location.** "No target location value the toolkit accepts, however it enters the toolkit, may be
   retained or used to create, write, move, rename, rewrite or delete anything if it contains a parent-directory
   segment (".."), including any location ultimately used."
2. **Refuse one entry, keep the rest.** A refused location is surfaced as an installation failure, has no side effect
   for that entry, and does not stop other legitimate entries from installing.
3. **Legitimate locations keep working.** Absolute locations with no `..`, including targets outside the installation
   directory, and ordinary nested targets install exactly as they do today.

**What the model must not do:** look up the upstream advisory or fix, or special-case the example. The instruction also
asks for a fix of "the problem and its close variants", and says the examples are "not the complete set". It names no
route, file or function.

### What makes it hard: nine routes, four modules

The report leads to one install-time write. The published upstream fix closes only L1 and L2 below. The over-broad
repairs (refuse every absolute or outside location, or refuse any name containing `..`) break locations that the
functional tests require.

| Route | Where | Real or added | Security test(s) |
|---|---|---|---|
| L1 Install-time write of the translated entry location: the reported case | `izpack-installer/.../unpacker/UnpackerBase.java:617-658` | Real upstream code, unmodified | 4 tests in `UnpackerTargetSecurityTest` (plain, introduced by a `${VAR}`, a directory, and one refused entry followed by a legitimate one) |
| L2 Public file-entry constructor in a separate module: the install-time check makes it look redundant | `izpack-api/.../api/data/PackFile.java:164-177` | Real upstream code, unmodified | `FileEntryApiSecurityTest` (`/` and `\` forms) |
| B1 Override rename: the rename destination is joined to the target's parent, and an existing file there is moved | `UnpackerBase.java:1322-1345` (`handleOverrideRename`) | Real upstream code, unmodified | `existingFileOutsideInstallDirectoryIsNotTouched` |
| B2 Parsable files: a file named by the metadata is translated and rewritten | `UnpackerBase.java:1361-1374` | Real upstream code, unmodified | `fileOutsideInstallDirectoryIsNotRewritten` |
| S1 Loose-file relocation: the destination is recomputed from an `installTarget` value | `izpack-installer/.../unpacker/LooseFileUnpacker.java:104-128` | Added to the product (`injection.patch`) | `relocatedEntryDoesNotEscapeInstallDirectory` |
| S2 Multi-volume unpacker: its own copy of the per-file step | `izpack-installer/.../multiunpacker/MultiVolumeUnpacker.java:174-200` | Added to the product (`injection.patch`) | `multiVolumeEntryDoesNotEscapeInstallDirectory` |
| N1 Removal-data step run after unpacking: the output directory and the file name both come from the metadata | `izpack-installer/.../data/UninstallDataWriter.java:521-531` | Real upstream code, unmodified | `uninstallerDirectoryDoesNotEscape`, `uninstallerFileNameDoesNotEscape` |
| N2 External install log: its location comes from a variable, and the value `default` is replaced by a location derived from N1's directory | `UninstallDataWriter.java:154-189` | Real upstream code, unmodified | `logFileDoesNotEscape`, `derivedLogFileDoesNotEscape` |
| N3 Configuration steps in another module: they write an output file (creating parents) and remove a patch file at declared locations | `izpack-util/.../config/ConfigFileTask.java:94-97`, `SingleXmlFileMergeTask.java:113-129` | Real upstream code, unmodified | `configurationFileDoesNotEscape`, `patchFileOutsideIsNotDeleted`, `xmlMergeOutputFileDoesNotEscape` |

S1 and S2 are two code paths added to IzPack in the style of the classes they sit in. Everything else is unmodified
upstream code. The build notes record that current upstream master still checks only L1 and L2 (read, not executed).
N1 to N3 were added in round 2 (see below).

### How it was made harder

The task went through three rounds of trials. Only the final round counts. The earlier rounds used different tests or
a different instruction, so their scores are not comparable with it.

| Round | Run | Tests (security / functional) | DeepSeek | MiMo | Outcome |
|---|---|---|---|---|---|
| 1. First build, batch 10 | [40647352109](https://github.com/sherazrazadev/swe-benching/actions/runs/40647352109) | 9 / 23 | 0.7778, 0.5556, 0.6667 | 0.7778, 0.7778, **1.0** | MiMo solved run 3 |
| 2. Trap stacking (`repair.yml`, mode `stack`) | [40755540825](https://github.com/sherazrazadev/swe-benching/actions/runs/40755540825) | 15 / 31 | 0.4667, 0.8667, 0.7333 | 0.3333, 0.4667, 0.6 | All failed; 2 audits found test faults |
| 3. Repair 1 | [40797405206](https://github.com/sherazrazadev/swe-benching/actions/runs/40797405206) | 17 / 33 | 0.5882, 0.7059, 0.5882 | 0.7059 (4 other attempts cut by API rate limits) | All failed; 2 audits found an instruction gap |
| 4. Repair 2: final | [40833539592](https://github.com/sherazrazadev/swe-benching/actions/runs/40833539592) | 17 / 33 | 0, 0.5882, 0.7059 | 0.4118, 0.4706, 0.4706 | All failed; 6 of 6 audits model-failed |

1. **Round 1.** The task had the six routes L1, L2, B1, B2, S1 and S2. DeepSeek missed B1 and S1 in every run (and B2
   and L2 once each). MiMo missed only L2, in runs 1 and 2, and solved run 3 (`ROUND1-MISSES.md`). So MiMo was the model
   to beat.
2. **Round 2, trap stacking** (`common/builder/BRIEF-trap-stack.md`). The six routes were kept as they were. Three new
   routes were added, chosen from the kinds the brief lists for a model like MiMo, which probes the code before it
   edits. All three are real upstream code:
   - N1, a far site in another installation step;
   - N2, a defaults route whose value is replaced by a keyword;
   - N3, a different feature family in another module, with a write form and a removal form.

   The instruction changed in one place: the list of forbidden side effects now includes "removed". Both models failed
   all six runs. However, the audits of DeepSeek run 1 and MiMo run 1 found a **test fault**. Two tests built their
   attack metadata through the public file-entry API (`PackFile` / `PackInfo.addFile`). A fix that also hardened that
   API made the test setup throw before the installer ran, so the test reported an error instead of a pass.
3. **Repair 1.** The changes:
   - The three affected tests (`LooseRelocation`, `OverrideRename`, `Parsable`) now build benign metadata and then
     insert the bad value by reflection. This is how deserialised metadata bypasses constructors, and how the main
     fixture already worked.
   - Two security tests were added: a refused entry must be reported while a later legitimate entry still installs,
     and the XML-merge form of N3.
   - Two functional controls were added to keep `a..b.txt` legal.
   - The reference fix now discards a refused entry's data and continues.
   - Three wrong-fix checks were added: abort the install, drop the entry silently, and refuse any `..` substring.
   - The instruction was reworded following that round's fairness review. This removed the sentence naming the public
     file-entry interface and the phrase "whichever installation step would use it".

   The audits of DeepSeek runs 1 and 3 then found an **instruction gap**. The rewording had narrowed the property to
   pack-entry locations, so N1 to N3 read as out of scope. DeepSeek run 3 passed every pack-entry test.
4. **Repair 2.** This changed the instruction only. Property 1 was widened to its current wording ("however it enters
   the toolkit, may be retained or used … including any location ultimately used"), the System section was reworded,
   and the sentence "The location came from the installer's own metadata." was removed. No test, route, reference fix or
   check patch changed: `tests/`, `solution/` and `environment/` are identical on branches `runs/40797405206` and
   `runs/40833539592`. The gate was re-run, and then the final trials.

### Tests and scoring

- **Security: 17 tests in 9 files.** Each test builds attack metadata containing `..`, serialises it where the installer
  reads serialised metadata, and drives the real code: the unpacker run, the public constructor, the removal-data
  writer or the shipped configuration task. It then checks that nothing was created, changed or deleted outside the
  installation directory. Refusal tests catch any exception and demand no exception class or message. The
  one-refused-entry test also checks that the next legitimate entry installs and that the unpacker reports failure.
- **Functional: 33 tests.** These are 20 hidden tests for legitimate use, plus 13 of the project's own tests
  (`DefaultFileUnpackerTest`, `LooseFileUnpackerTest`, `Pack200FileUnpackerTest`, `ScriptParserTest`,
  `MultiVolumeFileUnpackerTest`), run from pristine copies. The hidden tests cover:
  - nested and absolute targets, including targets outside the installation directory;
  - directory targets and `a..b` names;
  - renames and rewrites inside the directory;
  - relative and absolute loose relocation and a multi-volume entry;
  - removal data, the install log (declared, derived and outside) and the configuration steps.
- **Reward.** The reward is 1.0 only when every security and functional test passes. If any functional test fails,
  the reward is 0. Otherwise it is the share of security tests passed, capped at 0.99 (`tests/score.py`).

### Validation before any model ran (the gate)

These are the results of the final gate, after repair 2.

| Check | Expected | Result |
|---|---|---|
| Vulnerable code (no fix) | Every security test fails, every functional test passes | ✅ 17 fail / 33 pass |
| Reference fix (3 runs) | Everything passes | ✅ 50/50 each |
| Independent alternative fix (`pass-alt.patch`) | Everything passes | ✅ 1.0 |
| Hardening patch (`pass-hardening.patch`) | Everything passes | ✅ 1.0 |
| 11 fixes that each miss one route, or check before `${VAR}` substitution (`sf-miss-L1` … `sf-miss-N3`, `sf-after-translation`) | Each is caught by a security test | ✅ rewards 0.76–0.88 |
| Upstream fix sites only (`sf-published-only`) | Caught by security tests | ✅ 12 security failures (0.2941) |
| Abort the whole install, or drop the entry without reporting failure (`sf-abort-install`, `sf-silent-skip`) | Caught by the refused-entry test | ✅ 0.9412 each |
| 2 over-broad fixes: refuse any `..` substring, refuse outside or absolute locations | Each is caught by a functional test | ✅ 2 and 18 functional failures |

The gate verdict is pass (2026-10-29T08:00:16Z). No fresh-agent ("blind") fix was checked against this version; see
Caveats.

### Model results

The final trials were run on GitHub Actions in repair run 2,
[run 40833539592](https://github.com/sherazrazadev/swe-benching/actions/runs/40833539592). The agent limit was 3 h
(`CWE_AGENT_TIMEOUT_MULT=1.5`). Every counted run finished on its own; none hit the limit.

| Model | Run | Reward | Agent time | Counted? | Why it failed (Opus audit) |
|---|---|---|---|---|---|
| DeepSeek | 1 | 0 | 24 min | ✅ | Broke legitimate loose-file relocation. It moved the `installTarget` lookup after the entry is rebuilt, so both relocation functional tests error and the reward is 0. It also left the public constructor (L2), the removal data (N1), the log (N2) and the configuration steps (N3) unguarded (8 of 17 security) |
| DeepSeek | 2 | 0.5882 | 18 min | ✅ | Passed 10 of 17 and all functional tests. It closed every pack-entry route, including the constructor. It read `UninstallDataWriter` and left it unguarded, and it never touched N1, N2 or N3 |
| DeepSeek | 3 | 0.7059 | 22 min | ✅ | Passed 12 of 17. It also guarded the removal data and the log, but missed the public constructor (L2) and the configuration steps (N3) |
| MiMo | 1 | 0.4118 | 119 min | ✅ | Passed 7 of 17. It guarded only the base per-file step, so the multi-volume copy (S2) stayed open. It also missed L2, N1, N2 and N3 |
| MiMo | 2 | 0.4706 | 50 s recorded (see Caveats) | ✅ | Passed 8 of 17. All pack-entry routes were closed at install time. Its plan never considered the constructor, the removal data, the log or the configuration steps |
| MiMo | 3 | 0.4706 | 167 min | ✅ | Passed 8 of 17, with the same 9 misses as run 2. It decided that "nothing is validated at compile time or in constructors, since deserialization bypasses those". An earlier attempt was cut after 31 min by an API rate limit (HTTP 429) and re-run; that attempt is not counted |

Agent time is `duration_s` from `trial_detail_*.json`.

**The common failure:** the routes away from the unpacker. No run changed the configuration steps (N3). Its 3 tests
failed in all six runs. The public constructor (L2) failed in five runs; only DeepSeek run 2 guarded it. The removal
data and log (N1, N2) also failed in five runs; only DeepSeek run 3 guarded them. Every run closed the reported write
(L1), including the refuse-one-entry-and-continue rule, as well as B1, B2 and S1. In round 1, DeepSeek had missed B1
and S1 in every run. So the difficulty now lies in locations that the installer uses outside the per-entry unpack loop.

### Why this is fair

- **Fairness review: READY.** Every security test falls under property 1 read literally. "However it enters the
  toolkit", "retained or used" and "including any location ultimately used" reach the constructor, the removal-data
  and log locations, and the configuration steps. Three fixes reach 1.0: the reference, `pass-alt` and
  `pass-hardening`. The tests check effects, not the layer of the fix, and accept any refusal form. The full review is
  in [`verdicts/izpack-zip-path-inj-FAIRNESS.md`](verdicts/izpack-zip-path-inj-FAIRNESS.md).
- **The review left one question open for a human, in three parts.**
  1. Is the widened property meant to cover the removal-data, install-log and configuration-step locations (N1–N3)?
  2. Must a backslash-spelled `..` be refused on the Linux verifier?
  3. Is the unpacker's `getResult() == false` the intended "surfaced as an installation failure"?

  The audits answered all three:
  - **(1)** Five of six audits mark every N1–N3 test as stated in the instruction and fair. The MiMo run 1 audit marks
    the 3 configuration-step tests as instruction ambiguity, but keeps the run a model failure, because the
    multi-volume route and the constructor are clearly in scope and also fail. All six audits give medium confidence
    for this reason. The answer matters for one run: see Caveats.
  - **(2)** No run failed only the backslash form. Every run that failed the constructor test failed both forms.
  - **(3)** All six runs passed the refused-entry test.
- **Audits: 6 of 6 failing runs are trustworthy model failures** (all medium confidence). No audit found a harness
  error or a test that fails a correct fix. No run read the hidden tests, looked up the upstream fix, or made tool calls
  during grading. Three runs tried to download Maven with `wget`, which failed. The audits treat this as build tooling,
  not a lookup.
- **The task is real and solvable.** Seven of the nine routes are unmodified upstream code. Three different fixes reach
  1.0, and every miss above is a location that property 1 covers.

### Caveats

- **The N1–N3 scope question alone decides one run.** All 7 security failures of DeepSeek run 2 are N1–N3 tests. If
  those tests were taken out of scope, that run would pass 10 of 10 and score 1.0. The other five runs fail regardless:
  - DeepSeek run 1 has a functional regression;
  - DeepSeek run 3 and all three MiMo runs miss the constructor (L2);
  - MiMo run 1 also misses the multi-volume route (S2).

  The audit of DeepSeek run 2 judges N1–N3 covered "literally" by property 1 and the run a fair failure. It notes
  that the System section talks about per-entry locations, which leaves some ambiguity. The 3 configuration-step tests
  fail in every run and are the least explicit. The MiMo run 1 audit counts them as instruction ambiguity. The verdict
  page's wording that no audit "found a fault" is true at run level, but not for those 3 tests in that one audit.
- **Repeated repairs.** The task needed two repairs after audits found faults. The round-2 repair fixed tests that
  under-scored good fixes, and the final repair widened the instruction. Both changes make the task fairer, not
  harder. Repair 1 did also add two security tests (refused-entry reporting, and XML merge). Every final run passed the
  first of these. The second is one of the three N3 tests, which every run failed together. The intermediate scores
  are not comparable with the final ones.
- **The instruction no longer names the public file-entry interface.** Rounds 1 and 2 stated outright that a
  traversing target must be refused in the public file-entry interface. Repair 1 removed that sentence, and property 1
  now covers the interface only through "however it enters the toolkit, may be retained". L2 then failed in five of
  six final runs. Even when the sentence was there, MiMo missed L2 in two of three round-1 runs.
- **The review's "Required: generalize" notes were not applied.** The review asked to reword three phrases that point
  at the compile stage and the metadata channel ("compiles that description into an installer archive" and two uses
  of "packaged metadata"). The instruction the models saw still has them. That makes the task slightly easier, not
  harder.
- **No fresh-agent fix on the final version.** The only "blind" fix (a DeepSeek agent given the instruction, tree,
  tests, reference and route list) was made on 2026-10-28 for round 1 and passed then. It was deleted in round 2 because
  it predates the new routes. The manifest still declares it, but the final gate ran 17 checks without it. Solvability
  rests on the reference fix and the builder's `pass-alt` and `pass-hardening`, which are not independent agents.
- **The configuration-step tests call the task classes directly.** In the product, a listener in `izpack-event` runs
  these steps, and the verifier does not build that module. So the tests call the shipped task classes as the
  project's own `SingleConfigurableTaskTest` does, setting a `../` file through their setters. A round-3 audit
  questioned whether that is a value "from packaged metadata". The final review treats the setters as an accepted
  entry path.
- **MiMo run 2's agent time is not reliable.** `trial_detail_mimo.json` records 50 s and 3 turns, but the job took
  102 min of wall time (`wall_s` 6126), and the audit describes a full transcript with a plan and an install-time fix.
  The record probably covers only the last session segment. This was not verified.
- **The tests are lenient in places.** Refusal tests accept any exception, so an unrelated crash would count as a
  refusal. The review also lists cases no test catches:
  - a refused location written into the removal data or log;
  - the configuration copy tasks;
  - executable paths;
  - the uninstaller's deletions.

  None of this can lower a score.
- **MiMo was rate-limited.** In the final round, one MiMo attempt was cut by HTTP 429 and re-run. In repair 1, four
  MiMo attempts were cut, which left one scored MiMo run in that round.

### Evidence

- Final verdict page: [`verdicts/izpack-zip-path-inj.md`](verdicts/izpack-zip-path-inj.md). It lists the batch-10 run
  as the results branch; the final trial records are on `runs/40833539592`.
- Fairness review: [`verdicts/izpack-zip-path-inj-FAIRNESS.md`](verdicts/izpack-zip-path-inj-FAIRNESS.md)
- Audit of each failing run: [`audits/izpack-zip-path-inj-*/POSTMORTEM.md`](audits/)
- Final build, gate and trial records: branch [`runs/40833539592`](https://github.com/sherazrazadev/swe-benching/tree/runs/40833539592),
  `build/izpack-zip-path-inj/`:
  - `notes.md`, including the "Round 2", "Fairness revision" and "Audit revision" sections;
  - `gate_report.json`, `gate_verdict.json`, `gate-summary.md`, `manifest.json`, `FAIRNESS.md`, `ROUND1-MISSES.md`;
  - `trial_detail_*.json` and `audits/`;
  - the earlier rounds' audits, `AUDIT-FINDINGS.md` and `FAIRNESS.md` in `round0/` (round 2) and `round1/` (repair 1).
- First build and round-1 trials: branch [`runs/40647352109`](https://github.com/sherazrazadev/swe-benching/tree/runs/40647352109).
  The intermediate runs are on branches `runs/40755540825` (round 2) and `runs/40797405206` (repair 1).
