# winter-s4 — pre-trial fairness review

Legend (quotes from instruction.md): **P1** "Rendering it must never execute arbitrary PHP"; **P2** "expose files or host values that the template was not given"; **P3** "create, modify or delete stored files"; **P4** "change stored records"; **X** "whichever template is rendered and whatever values the application passes in or the template carries along"; **K** "Everything that works today keeps working exactly as today"; **C** "callbacks written in the template still work on the values the application supplies".

## 1. Tests

| test | asserts | covering sentence | could a correct fix fail? | risk |
|---|---|---|---|---|
| security/SecurityThemeConfigWriteTest::testThemeConfigurationCannotBeChangedByATemplate | theme.yaml byte-identical after the reported page renders | P3; the reported example | no — name-block at the policy, guard inside the writer, or refusal all pass | low |
| security/SecurityCollectionStringCallableTest::testCollectionMethodDoesNotExecuteAStringCallableFromATemplate | marker file not created by `each('touch')` on a plucked collection | P1 | no — any refusal or non-closure-callable neutralisation passes | low |
| security/SecurityAttributeFunctionCallableTest::testAttributeHelperDoesNotExecuteAStringCallable | same via `attribute()` | P1; X | no — the natural fix sits in the shared get-attribute/policy layer; a dot-call-only patch does not meet P1/X | medium |
| security/SecurityPaginatorCallableTest::testPagedResultsDoNotExecuteAStringCallableFromATemplate | marker absent after `paginator.through('touch')` with an app-supplied paginator | P1; X | no — paginated results are "values the application passes in" | medium |
| security/SecurityCollectionArrayCallableTest::testCollectionMethodDoesNotExecuteAnArrayCallableFromATemplate | victim file still present after `filter(['…File','delete'])` | P1; standard expert knowledge: `[class, method]` is a PHP callable | no — a fix that tests callables after recursing covers it | medium |
| security/SecurityCollectionArrayCallableTest::testBuiltInAttributeHelperDoesNotExecuteAnArrayCallable | same via `attribute()` | P1; X; expert knowledge (array callable) | no | medium |
| security/SecurityPageFileBuilderTest::testPageFileCannotBeOverwrittenThroughAQueryObject | page file unchanged after `this.page.newQuery().update(...)` | P3; X | no — must model forwarding or block the query write; blocking all `newQuery` instead breaks K | medium |
| security/SecurityModelWriteTest::testStoredRecordCannotBeChangedThroughAQuietSave | row name unchanged after `forceFill(...).saveQuietly()` | P4 | no | low |
| security/SecurityModelWriteTest::testStoredRecordCannotBeChangedThroughAForwardedCounter | counter unchanged after `model.increment('count', 7)` | P4; X | no — forwarding is visible framework behaviour | medium |
| security/SecurityModelWriteTest::testStoredRecordCannotBeChangedThroughAQueryObject | row name unchanged after `newQuery().update(...)` | P4; X | no | medium |
| security/SecurityModelForwardCallableTest::testForwardedModelMethodDoesNotExecuteAStringCallable | row value not echoed by `model.each('var_dump')` | P1; X | no | medium |
| security/SecurityThemeConfigSiblingTest::testThemeConfigurationCannotBeChangedByATemplateThroughASetter | theme.yaml unchanged after `saveConfigValue(...)` | P3; X; "example … not the full set" | no — policy block or an in-PHP guard both pass | medium |
| security/SecurityPageFileSiblingTest::testPageFileCannotBeOverwrittenThroughASaveHelper | page file unchanged after `saveAttributes(...)` | P3; X; "example … not the full set" | no — same two valid layers | medium |
| security/SecurityFunctionSurfaceTest::testHostConstantIsNotExposedToATemplate | `PHP_VERSION` not in output of `constant('PHP_VERSION')` | P2 | no | low |
| security/SecurityFunctionSurfaceTest::testStoredTemplateSourceIsNotExposedToATemplate | stored template body not echoed by `source(...)` | P2 | no | low |
| functional/FunctionalTemplateBasicsTest::testSettingsConditionsLoopsAndFiltersStillRender | settings, if, for, filter and partial render | K | no | low |
| functional/FunctionalThemeCollectionTest::testThemePagesStillIterateInATemplate | `this.page.get()` iterates 3 pages with `fileName` and `length` | K; lists iterate/count | no — a correct wrapper must stay iterable/Countable | low |
| functional/FunctionalCollectionReadsTest::testCollectionsStillIterateIndexCountAndSelectValues | for/length/index/pluck/where/sortBy/groupBy | K | no — string attribute args are not callables and survive callable stripping | low |
| functional/FunctionalCollectionReadsTest::testCollectionRendersAsAValue | `items\|raw` renders the collection | K (display) | no — a proxy must keep `Jsonable`/`__toString`, as the reference does | low |
| functional/FunctionalCollectionCallbacksTest::testTemplateCallbacksStillWorkOnCollections | `filter`/`map` arrow closures run | C | no — C explicitly allows template closures | low |
| functional/FunctionalCollectionCallbacksTest::testTemplateCallbacksStillWorkOnPagedResults | `through(closure)` runs | C; paged results still work | no | low |
| functional/FunctionalArrowFiltersTest::testTwigArrowFunctionFiltersStillRender | `\|map`/`\|filter`/`\|sort` arrows | C; built-in filters | no | low |
| functional/FunctionalPaginatorReadsTest::testPagedResultsStillNavigateAndIterate | total/currentPage/length/iteration | K; paged results | no | low |
| functional/FunctionalModelReadsTest::testStoredValuesStillReadAndCount | `model.name`, `getAttribute`, `newQuery().count()` | K; stored values | no — reads must stay open; blocking them is overbroad | low |
| functional/FunctionalSessionTest::testAllowedSessionMethodsStillWork | session put/get/has/forget | K (these work today; the visible policy allowlists them) | no — blocking session writes is overbroad and contradicts K | low |
| modules/system/tests/twig (27 project tests, incl. SecurityPolicyTest) | existing sandbox-policy behaviour | K; visible in the repo | no — reference, pass_alt, pass_hardening and blind all reach 1.0 | low |

## 2. Leniency (QUALITY)

| property / trap | most plausible WRONG fix | caught by |
|---|---|---|
| P1 | strip string callables only, not arrays | SecurityCollectionArrayCallableTest (checks/sec_fail_array.patch); attribute variant too |
| P1 | cast only the dot-call spelling, not `attribute()` | SecurityAttributeFunctionCallableTest; SecurityCollectionArrayCallableTest::…BuiltInAttributeHelper… |
| P1 | strip every callable, including template closures | functional/FunctionalCollectionCallbacksTest (no patch; manifest notes it) |
| P2 | leave `checkSecurity` body empty (upstream state) | SecurityFunctionSurfaceTest (checks/sec_fail_functions.patch) |
| P2 | block `source` but not `constant` | SecurityFunctionSurfaceTest::testHostConstant… |
| P3 | block only the reported `writeConfig` | SecurityThemeConfigSiblingTest (checks/sec_fail_s1.patch); actually checks/sec_fail_theme.patch is the reciprocal |
| P3 | block the page's `update` but not the helper/query object | SecurityPageFileSiblingTest (checks/sec_fail_s2.patch); SecurityPageFileBuilderTest (checks/sec_fail_builder.patch) |
| P4 | add quiet names only, no forwarding | SecurityModelWriteTest::…ForwardedCounter/…QueryObject (checks/sec_fail_models.patch) |
| T1 | fix only the example | SecurityThemeConfigSiblingTest, SecurityPageFile*, SecurityCollection* |
| T2 | name-block `map`/`each`/`through` | functional/FunctionalArrowFiltersTest, FunctionalCollectionCallbacksTest |
| T3 | recursion returns from the array branch before the callable test | SecurityCollectionArrayCallableTest (checks/sec_fail_array.patch) |
| T4 | block `update` on the page only | SecurityPageFileBuilderTest (checks/sec_fail_builder.patch) |
| T5 | model-only blocklist | SecurityModelWriteTest::…ForwardedCounter (checks/sec_fail_models.patch) |
| T6 | block `writeConfig`, not the setter | SecurityThemeConfigSiblingTest |
| T7 | block the query write, not the helper | SecurityPageFileSiblingTest (checks/sec_fail_s2.patch) |
| T8 | keep the function check empty | SecurityFunctionSurfaceTest (checks/sec_fail_functions.patch) |

**Wrong fixes no test catches:** making the dangerous methods silent no-ops (every security test asserts only absence of effect, never that an error was raised as the contract demands); blocking `getFilePath` instead of `source` (the stored-source test passes while `source('theme.yaml')` stays open); omitting `enum_cases` (blocked by the reference, driven by no test); denying every `Theme` method or dropping `this.theme` (no functional test reads a legitimate theme value); blocking the built-in `attribute()` function outright or denying all Controller methods (no legitimate-use test exercises them). Note also that `checks/func_fail_overbroad.patch` throws in `checkPropertyAllowed` with an undefined `$method`, so it only fails property-reading functional tests — relabel/fix it if the catalogue is used as evidence.

## 3. Hints (QUALITY)

- "…`this.theme.writeConfig({ name: "compromised" })`" (the example) names the object and method. Neutral: report the outcome only — "an attacker-chosen value appeared in the theme's configuration file after template content was stored".
- "the editor refuses to save a PHP code section in a template, while HTML and expressions stay editable" names a stage and a format. Neutral: "safe mode is meant to keep template content within the template language".
- "…lists and paged results…, and callbacks written in the template still work…" enumerates the tested surfaces (T2/T3). Neutral: "Everything that works today keeps working exactly as today, for every value the application supplies".

## Required: generalize

- The Contracts bullet quoted above is a checklist of the objects the callable traps use. Reword to the property alone: "Everything that works today keeps working exactly as today, for every value the application supplies to a template."

## Quality to tighten

1. Assert `error !== null` in one security test per mechanism (T1, T2, T3, T5, T8); today silent no-ops pass.
2. Add a functional `this.theme.getConfigValue('name')` read so deny-all-Theme fails.
3. Drive `source()` with a template name, not only `getFilePath()`, so blocking the getter fails.
4. Test `enum_cases`, and a legitimate `attribute(items,'pluck',['n'])`.
5. Apply the hint rewrites; fix `func_fail_overbroad.patch`, which throws on property reads with an undefined `$method`.

## Verdict

**READY (gate a).** Every security route is covered literally by P1–P4; unnamed routes (array callables, forwarding, injected helpers) are instances of them or standard PHP/framework knowledge. Upstream leaving a route open is irrelevant. Four independent fixes reach 1.0 (reference, reflection-based `pass_alt`, `pass_hardening`, `blind.patch`), so no single design is demanded. The harness uses the project's own entry points, accepts any throwable, and demands no error class. A page-render-only guard would fail `renderTemplate`, but it does not satisfy X, so it is not correct. Functional tests rest on K or C.

Human review: confirm that the `renderTemplate` harness (application-supplied values via `Controller::getTwig`) is in scope under X, and that keeping sandboxed template closures while refusing PHP callables is the intended reading of P1 against C.

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
