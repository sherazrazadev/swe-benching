# winter-s4 — pre-trial fairness and leniency review

Reviewed: `tasks/winter-s4/instruction.md`, every file under `tasks/winter-s4/tests/`,
`solution/fix.patch`, `build/winter-s4/manifest.json`, `notes.md`, `checks/*.patch`.
The repository itself is not present in this review workspace; the project's own
`modules/system/tests/twig` suite (27 tests, part of the functional group per `tests/support/run.php:38`)
is assessed from the gate evidence (the three `SecurityPolicyTest` names the overbroad patch fails).

Legend (quotes from instruction.md):
**P1** "Rendering it must never execute arbitrary PHP" · **P2** "expose files or host values that the
template was not given" · **P3** "create, modify or delete stored files" · **P4** "change stored
records" · **R** "A render that would do any of these is refused with an error and leaves no such
effect" · **X** "whichever template is rendered and whatever values the application passes in or the
template carries along" · **K** "Everything that works today keeps working exactly as today, for every
value the application supplies to a template" · **S** "settings and stored values still bind" ·
**M** "stored records can still be read and counted, including when a template reads or counts them
through the model it was given" · **L** "lists and paged results supplied by the application still
display, iterate and count" · **C** "callbacks written in the template still work on the values the
application supplies".

The harness catches every `Throwable` at both entry points (`renderTheme`, `renderTemplate`) and
returns it as `error`; no test inspects an error class or status, so "an error page, or an error
raised while the template is processed" is satisfied by any refusal form, and a guard placed at any
layer (policy name block, in-PHP guard inside the writer/helper, query-layer guard) qualifies.

## 1. Tests

| test | what it asserts | covering sentence | could a correct fix fail it? | risk |
|---|---|---|---|---|
| security/SecurityThemeConfigWriteTest::testThemeConfigurationCannotBeChangedByATemplate | `theme.yaml` byte-identical and `error` non-null after a page calls the theme config writer | P3, R, X | no — a name block in the policy, a guard inside the writer, or a refusal at the node layer all throw; only a silent no-op fails, and R forbids it | low |
| security/SecurityThemeConfigSiblingTest::testThemeConfigurationCannotBeChangedByATemplateThroughASetter | `theme.yaml` unchanged through the single-value setter (no error demanded) | P3, X | no — blocking the helper, guarding the helper, or guarding the writer it calls all pass | low |
| security/SecurityCollectionStringCallableTest::testCollectionMethodDoesNotExecuteAStringCallableFromATemplate | marker file never created and `error` non-null after `each('touch')` on a plucked collection | P1, R, X | no — stripping the argument yields a `TypeError` from the `callable` parameter (an error raised while the template is processed); an explicit refusal passes too | medium |
| security/SecurityCollectionArrayCallableTest::testCollectionMethodDoesNotExecuteAnArrayCallableFromATemplate | victim file survives and `error` non-null after `each([File, 'delete'])` | P1, R, X; standard expert knowledge: `[class, method]` is a PHP callable | no — testing callability after recursion, or a reflection-based refusal, passes | medium |
| security/SecurityCollectionArrayCallableTest::testBuiltInAttributeHelperDoesNotExecuteAnArrayCallable | same through the built-in attribute helper | P1, R, X; standard expert knowledge (array callable) | no | medium |
| security/SecurityAttributeFunctionCallableTest::testAttributeHelperDoesNotExecuteAStringCallable | marker absent after the attribute helper passes `'touch'` (no error demanded) | P1, X | no — a dot-call-only guard does not meet P1, so a correct fix must cover the shared attribute path | medium |
| security/SecurityPaginatorCallableTest::testPagedResultsDoNotExecuteAStringCallableFromATemplate | marker absent after `through('touch')` on an application-supplied paginator | P1, X ("values the application passes in") | no | medium |
| security/SecurityPageFileBuilderTest::testPageFileCannotBeOverwrittenThroughAQueryObject | page file unchanged after `this.page.newQuery().update({...})` | P3, X | no — forwarding-aware policy or a guard on the query write passes; blocking the read accessor is overbroad and fails K/M, so it is not correct | medium |
| security/SecurityPageFileSiblingTest::testPageFileCannotBeOverwrittenThroughASaveHelper | page file unchanged through the save helper | P3, X, "one instance, not the full set" | no — guard in the helper, in the query write, or in the policy all pass | medium |
| security/SecurityModelWriteTest::testStoredRecordCannotBeChangedThroughAQuietSave | row name unchanged and `error` non-null after `forceFill(...).saveQuietly()` | P4, R | no | low |
| security/SecurityModelWriteTest::testStoredRecordCannotBeChangedThroughAForwardedCounter | counter unchanged after `model.increment(...)` | P4, X; standard expert knowledge: `Model::__call` forwards to the builder/query layer | no | medium |
| security/SecurityModelWriteTest::testStoredRecordCannotBeChangedThroughAQueryObject | row name unchanged after `model.newQuery().update({...})` | P4, X | no | medium |
| security/SecurityModelForwardCallableTest::testForwardedModelMethodDoesNotExecuteAStringCallable | row value never echoed by `model.each('var_dump')` | P1, X | no | medium |
| security/SecurityFunctionSurfaceTest::testHostConstantIsNotExposedToATemplate | `error` non-null and `PHP_VERSION` absent after `constant('PHP_VERSION')` | P2, R | no — the sandbox's natural function check throws | low |
| security/SecurityFunctionSurfaceTest::testStoredTemplateSourceIsNotExposedToATemplate | stored body not echoed twice via `source(this.page.getFilePath())` | P2, X | no — blocking the function or the getter both pass | low |
| security/SecurityFunctionSurfaceTest::testStoredTemplateSourceIsNotExposedWithoutAGetter | stored body not echoed when the absolute name is written into the template | P2 | no — requires blocking the function rather than the getter, which P2 already demands | medium |
| security/SecurityFunctionSurfaceTest::testEnumCasesAreNotExposedToATemplate | enum case value absent after `enum_cases(...)` | P2 | no | low |
| functional/FunctionalTemplateBasicsTest::testSettingsConditionsLoopsAndFiltersStillRender | settings, `if`, `for`, filter, partial render; `error` null | K, "loops, conditions, partials and the built-in filters still render" | no | low |
| functional/FunctionalCollectionReadsTest::testCollectionsStillIterateIndexCountAndSelectValues | iteration, length, index, pluck, where, sortBy, groupBy and the attribute helper with a string key | L, K | no — string keys are not PHP callables and survive any correct stripping | medium |
| functional/FunctionalCollectionReadsTest::testCollectionRendersAsAValue | `items` with the raw filter still renders its values | L ("display"), K | no — a proxy must stay string/JSON-convertible, which L requires | low |
| functional/FunctionalCollectionCallbacksTest::testTemplateCallbacksStillWorkOnCollections | `filter`/`map` arrow closures run | C | no | low |
| functional/FunctionalCollectionCallbacksTest::testTemplateCallbacksStillWorkOnPagedResults | `through(closure)` runs | C, L | no | low |
| functional/FunctionalArrowFiltersTest::testTwigArrowFunctionFiltersStillRender | `map`/`filter`/`sort` arrow filters render | C, "built-in filters" | no | low |
| functional/FunctionalThemeCollectionTest::testThemePagesStillIterateInATemplate | `this.page.get()` iterates three pages with `fileName` and length | M, L | no | low |
| functional/FunctionalThemeCollectionTest::testThemeConfigurationValueStillReadsInATemplate | a theme configuration value still renders | S, K | no — a deny-all-Theme fix fails S, so it is overbroad, not correct | medium |
| functional/FunctionalPaginatorReadsTest::testPagedResultsStillNavigateAndIterate | total, current page, length and iteration | L, K | no | low |
| functional/FunctionalModelReadsTest::testStoredValuesStillReadAndCount | attribute read plus `newQuery().count()` render | M, S, K | no — M now states the read/count requirement; blocking the read accessor contradicts it | medium |
| functional/FunctionalSessionTest::testAllowedSessionMethodsStillWork | session put/get/has/forget | K | no | low |
| modules/system/tests/twig (27 project tests, incl. SecurityPolicyTest::testAllowedMethods, ::testCanReadFromAModel, ::testExtendingModelBeforePassingIntoTwigShouldStillWork) | the project's existing sandbox-policy behaviour, visible in the repo | K | no — the reference, pass_alt, pass_hardening and blind each score 1.0; the overbroad patch fails three of these | low |

## 2. Leniency (quality, non-blocking)

### Security properties

| property | most plausible WRONG fix | caught by |
|---|---|---|
| P1 | strip string callables only and let arrays through (the published fix's own shape) | SecurityCollectionArrayCallableTest ×2 (`checks/sec_fail_array.patch`) |
| P1 | cast only the dot-call spelling, not the built-in attribute helper | SecurityAttributeFunctionCallableTest; SecurityCollectionArrayCallableTest::testBuiltInAttributeHelper (`checks/sec_fail_callables.patch`) |
| P1 | build the safe proxies but never register the node visitor that applies them | the same five callable tests (`checks/sec_fail_callables.patch`) |
| P1 | strip or deny every callable, including template closures | FunctionalCollectionCallbacksTest; FunctionalArrowFiltersTest (no check patch) |
| P1 | name-block `each`/`map`/`filter`/`through` instead of neutralising arguments | the same functional tests (no check patch) |
| P2 | leave the function check empty (upstream state) | SecurityFunctionSurfaceTest ×4 (`checks/sec_fail_functions.patch`, `sec_fail_reads_only.patch`) |
| P2 | block `source` only, not `constant`/`enum_cases` | testHostConstant…, testEnumCases… (no check patch) |
| P2 | block the file getter instead of the reader function | testStoredTemplateSourceIsNotExposedWithoutAGetter |
| P3 | block only the reported writer, leave the single-value setter | SecurityThemeConfigSiblingTest (`checks/sec_fail_s1.patch`) |
| P3 | block the theme writer but not the page write paths | SecurityPageFileBuilderTest (`checks/sec_fail_builder.patch`); SecurityPageFileSiblingTest (`checks/sec_fail_s2.patch`) |
| P4 | add quiet write names only, no forwarding model | SecurityModelWriteTest::…ForwardedCounter; …QueryObject (`checks/sec_fail_models.patch`) |
| P4 | model-only blocklist | the same three plus SecurityModelForwardCallableTest (`checks/sec_fail_models.patch`) |
| all | fix only the function surface | every other security test (`checks/sec_fail_reads_only.patch`) |
| (control) | refuse every method call | FunctionalCollection…, FunctionalArrow…, FunctionalSession, FunctionalModelReads, both theme reads and three project tests (`checks/func_fail_overbroad.patch`, reward 0.0) |

### Traps

| trap | most plausible WRONG fix | caught by |
|---|---|---|
| T1 theme config write | block the named writer only; leave the sibling setter | SecurityThemeConfigSiblingTest (no dedicated patch; reciprocal of `checks/sec_fail_s1.patch`) |
| T2 callable arguments | neutralise only the dot-call, or only strings, or forget to wire the proxy in | SecurityAttributeFunctionCallableTest; SecurityPaginatorCallableTest; SecurityCollectionArrayCallableTest (`checks/sec_fail_callables.patch`, `sec_fail_array.patch`) |
| T3 array-form callable | recurse into arrays and return from the array branch before testing whether the array itself is callable | SecurityCollectionArrayCallableTest ×2 (`checks/sec_fail_array.patch`) |
| T4 receiver identity | block `update` on the page object but not on the query object it forwards to | SecurityPageFileBuilderTest (`checks/sec_fail_builder.patch`) |
| T5 database writes | add the quiet names but not the forwarding layer; or block the model only | SecurityModelWriteTest ×3; SecurityModelForwardCallableTest (`checks/sec_fail_models.patch`) |
| T6 injected theme setter | block only the reported writer | SecurityThemeConfigSiblingTest (no dedicated patch) |
| T7 injected page helper | guard the query write only, leave the helper | SecurityPageFileSiblingTest (`checks/sec_fail_s2.patch`) |
| T8 function surface | empty function check, or block one function name | SecurityFunctionSurfaceTest ×4 (`checks/sec_fail_functions.patch`) |

### Wrong fixes no test catches

- **Silent neutralisation instead of refusal** on the nine security tests that only assert absence of
  effect (theme setter, page builder, page sibling, model counter, model query object, forwarded
  callable, paginator, the two `source` tests, `enum_cases`). R demands an error; no test enforces it
  there. The reference itself returns `$this` for `mapinto`/`pipeinto`/`toresourcecollection`.
- **Blocking only the executor name the test drives** (`each`) on models/builders; `chunk`,
  `chunkById`, `when`, `pipe` stay open.
- **Blocking the read accessor on the page/Halcyon model** (`this.page.newQuery()`): no functional
  test reads or counts through the page's query object, so this overbroad fix passes while breaking a
  legitimate page-file read.
- **Blocking every controller method**: no hidden functional test drives a controller method from a
  template (only the project's own suite may notice).
- **Name-by-name whack-a-mole** covering exactly the driven names (`writeConfig`, `saveConfigValue`,
  `saveAttributes`, `forceFill`, `saveQuietly`, `increment`, `newQuery().update`) passes while
  `decrement`, `touch`, `updateOrCreate` and the remaining write helpers stay reachable.
- **Nulling a legitimate non-hybrid string argument that is also a PHP function name** (e.g.
  `where('max', false)`): no functional test covers it and the reference's own stripper does it.

## 3. Hints and surface descriptions (quality, non-blocking)

1. "With safe mode enabled, an account that may only edit pages stored a page body. The next render
   wrote an attacker-chosen value into the theme's configuration file." — names the channel (page
   body, page-only account) and the T1 destination in product terms. Neutral: "A limited
   template-editing account stored template content, and the next render changed a stored file that
   account cannot change directly."
2. "templates — pages, layouts and partials — that mix HTML with an expression language" — template
   kinds (a variant list). Neutral: "site content as templates that mix HTML with an expression
   language".
3. The Contracts enumeration "loops, conditions, partials and the built-in filters still render;
   lists and paged results supplied by the application still display, iterate and count; …
   including when a template reads or counts them through the model it was given" — rehearses the
   tested surfaces and one object kind (the model). Neutral: keep the property over the outcome
   ("stored records can still be read and counted"; "the values the application supplies still
   display, iterate and count"; "ordinary template constructs still render"). Do not delete the
   behaviour requirements; the functional group rests on them.
4. "The incident above is one instance, not the full set of ways this can happen." and "Fix the
   problem and its close variants." — flaw multiplicity and the fix approach (generalise). The
   property paragraph already binds every route; delete both.
5. "callbacks written in the template still work on the values the application supplies" — names the
   mechanism a fix must special-case. Retain it: it is a behaviour statement, and removing it would
   make "strip all callables" look correct.
6. "safe mode" — a product mode name, but it is the report's precondition and not a fix location;
   acceptable. Borderline, no change proposed.

## 4. Realism (quality, non-blocking)

- T1 (`Theme` config write), T2 (collection/paginator callable parameters), T4 (`Halcyon Model::__call`
  to the query builder), T5 (quiet Eloquent names plus `__call` forwarding) and T8 (the empty
  function check) are real, unmodified upstream code, reachable from the theme render and from the
  Twig environment; they are realistic by definition.
- T3 (array callable) is a gap in the published fix's own recursive stripper, not a planted sink;
  the sink (PHP array callables) is standard language behaviour. Realistic.
- T6 (`Theme::saveConfigValue` calling `writeConfig`) and T7 (`CmsCompoundObject::saveAttributes`
  calling `newQuery()->update`) are injected, but each is a short, ordinary convenience helper in the
  same style as the class around it, reachable from `this.theme` / `this.page`. No trap code looks
  contrived or unreachable through the real entry point. T6 sits directly beneath the getter the
  functional test uses, which makes it easy to spot once the class is read; that is a discoverability
  nit, not a realism defect.

## Verdict

**READY (gate a).** The security routes are named by the property read literally: stored files (P3)
for the theme file and the page file; "execute arbitrary PHP" (P1) for `touch`/`File::delete`/
`var_dump`; "files or host values … not given" (P2) for `constant`/`enum_cases`/`source`; stored
records (P4) for the model and query writes. "Whichever template is rendered and whatever values the
application passes in" covers both harness entry points and application-supplied collections,
paginators and models. The six error assertions rest on "refused with an error": any Throwable, any
error class, any guard layer qualifies. Functional keeps rest on the visible K/S/M/L/C sentences, so
the fixes that break them are wrong, not correct. Four independent fixes reach 1.0;
func_fail_overbroad scores 0.

### Required: generalize

1. "What we saw" (page body → theme configuration file): state only that a limited template-editing
   account's content changed a stored file that account cannot change directly.
2. "templates — pages, layouts and partials —" → "site templates".
3. "loops, conditions, partials and the built-in filters still render" → "ordinary template
   constructs still render".
4. "lists and paged results supplied by the application still display, iterate and count" → "the
   values the application supplies still display, iterate and count".
5. "including when a template reads or counts them through the model it was given" → keep "stored
   records can still be read and counted"; the functional test stays covered.
6. Delete "one instance, not the full set".

### Quality to tighten

1. Error assertions on the nine effect-only security tests (setter, page builder/sibling, model
   counter/query, forwarded callable, paginator, `source` ×2, `enum_cases`), so silent no-ops fail.
2. A second executor name (`chunk`/`when`/`pipe`) through the model path.
3. A legitimate `this.page.newQuery().count()` read.
4. Cover `where('max', …)`; apply the rewordings; keep the callback clause.

Human review: confirm `Controller::getTwig()` + `createTemplate` counts as "whichever template is
rendered", that "refused with an error" obliges a Throwable (basis for the six error assertions), and
that rewordings 3–5 keep every functional test covered.

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
