# Accepted tasks: results

These tasks passed every step of the cwe-bench pipeline on GitHub Actions:

- **Build and gate.** The vulnerable code fails every security test, and the reference fix passes everything.
- **Trials.** Both DeepSeek and MiMo failed every counted run, so no run reached a full score.
- **Independent audits.** A Claude Opus audit of each failing run found it was the model's own failure, not a fault in the task.
- **Fairness review.** The review returned READY.

| Task | Weakness | Language | Project | DeepSeek | MiMo | Verdict |
|---|---|---|---|---|---|---|
| [`jenkins-s3`](#jenkins-s3) | CWE-502 (deserialization of untrusted data) | Java | [jenkinsci/jenkins](https://github.com/jenkinsci/jenkins) | 0.6, 0.6, 0.6 | 0, 0, 0, 0 (+1 excluded) | **ACCEPTED** |

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
