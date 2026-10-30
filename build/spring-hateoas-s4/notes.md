# spring-hateoas-s4 — build notes

Start (from build/spring-hateoas-s4/start_utc.txt): 2026-10-30T07:36:51Z
End: 2026-10-30T09:05Z (all four gate stages passed).

Repository: spring-projects/spring-hateoas
Pinned (vulnerable) commit: 6b6622c92fd06d028a1d4522addf0e214c079f29 (parent of the main-branch fix)
Published fix used for this tree: 87d73a7af52d70e51823f44a67371b7a8a54b7c1 (the 2c127edd/87d73a7/d8050ee
triplet are the same change on 2.5.x/3.1.x/3.0.x; only 87d73a7 applies to this tree).
Track: injected. Pattern: A.

## Protected outcome (the one general property)

Whenever the library converts a document into an application object, a value in the document must not
set a property that the JSON binding in effect on the mapper performing the read does not expose for
input; only exposed names bind. This covers every supported hypermedia format, every representation
wrapper, and mapper-level configuration, not only annotations on the model.

## Levers (each with a different reason a solver would skip it)

1. **T1 mapper configuration + rename (how-type, shape).** The pinned helper uses JavaBeans
   descriptors, so mapper-level configuration (a mix-in hiding a property) and configured external
   names (a property exposed only under its renamed name) are ignored. A plausible wrong fix reuses
   the existing hand-rolled annotation filters in `PropertyUtils.getPropertyDescriptors`, which look
   sufficient on the reported annotated model but never see mix-ins or renames.
   Site: `src/main/java/org/springframework/hateoas/mediatype/PropertyUtils.java:101-122` (fix site).
   Reason to dismiss: "the class already filters @JsonIgnore/@JsonIgnoreProperties for the
   serialization side; call the same filter on the way in."
2. **T2 partial documents / initialisers (how-type, coupled must-keep-working).** The published shape
   iterates every property Jackson exposes and writes `properties.get(name)` unconditionally, which
   nulls (and on primitives throws for) properties the document never mentions. The natural
   implementation has this bug; a correct fix must write only supplied names.
   Site: `PropertyUtils.java:103-134` (fix site). Reason to dismiss: "walk all exposed properties and
   copy their values; missing keys are just null."
3. **T3 other document routes (Pattern A far sites).** The report's example is a single Collection+JSON
   entity. The same construction is reached from the Collection+JSON template branch, the
   CollectionModel/PagedModel item deserializers, and the UBER entity/collection/paged deserializers in
   a different package. Someone who fixes only the example's deserializer leaves these open.
   Sites: `CollectionJsonJacksonModule.java:626-855`, `CollectionJsonItem.java:198-211`,
   `UberJacksonModule.java:533-905`. Reason to dismiss: "another media type / another wrapper is a
   neighbouring feature".
4. **T4 HAL-FORMS template read (injected, route where the protection never existed, how-type).** A
   HAL-FORMS response carries form templates with name/value entries. A reader that applies submitted
   template values to the content object existed nowhere upstream and is added here with its own
   reflective writer, in a package the published fix never touches. Reason to dismiss: "forms are an
   output/affordance media type, not one of the formats in the report."
   Files: `mediatype/hal/forms/HalFormsTemplateDataDeserializer.java`,
   `HalFormsTemplateValues.java`, registration in `HalFormsJacksonModule.java` (new code; injection).
5. **T5 problem-details typed payload (injected, route where the protection never existed).** Reading an
   `ExtendedProblem<T>` document builds T from the extension members. Added here with its own reflective
   writer; the published fix never touches the package. Reason to dismiss: "error documents are written
   by servers, not submitted input."
   Files: `mediatype/problem/ProblemPayloadDeserializer.java`, `ProblemPayloadValues.java`,
   `ProblemJacksonModule.java`, registration in `HttpProblemDetailsMappingInformation.java` (injection).

Coupled legitimate behaviour tested functionally for each: visible values bind next to a hidden one;
partial documents keep initialisers and primitives; links, collections and plain HAL-FORMS round-trips
keep working.

## Sibling candidate inventory (injected track)

Searched the whole `src/main` tree for the property-writing primitive (`BeanUtils.*PropertyDescriptor`,
`Method.invoke`, `BeanUtils.instantiateClass`, `BeanWrapper.setPropertyValue`). Candidates:

| Candidate | Reachable entry point | Realistic? | Decision |
|---|---|---|---|
| HAL-FORMS `_templates` name/value reader (`hal/forms`, untouched by the fix) | `HalFormsJacksonModule` on a mapper; `EntityModel` and embedded resources | yes — mirrors the Collection+JSON template branch; `HalFormsDeserializers` already read documents | **picked (T4)** |
| Problem-details typed payload reader (`problem`, untouched) | `ProblemJacksonModule` (registered by `HttpProblemDetailsMappingInformation`) on a mapper; `ExtendedProblem<T>` | yes — generic `@JsonUnwrapped` payload binding is fragile; a hand-written reader is a natural workaround | **picked (T5)** |
| `UberAction`/`UberData` action route | UBER module | no — UBER has no name/value action payload; the existing data routes are already covered by the published fix | rejected (not a real route) |
| Collection+JSON `queries[].data` route | `CollectionJsonResourceDeserializer` | weak — queries are request metadata, and the route would live inside the very method the fix edits | rejected (report leads there) |
| Legacy Collection+JSON/new module registered from the media-type configuration | Spring `HypermediaMappingInformation` only | weak — no document shape exists for it; requires inventing a format | rejected (contrived) |
| Second public materialisation helper in `PropertyUtils` (screener O8b #2) | public API callers | yes, but it sits in the file the published fix rewrites | rejected (same file as the fix; hidden) |
| ALPS descriptor-driven binder | no sink: ALPS documents carry no name/value content | no | rejected |
| HAL `_embedded` reader | HAL binds content with Jackson already (safe) | no vulnerability without inventing a map format | rejected |
| VND-ERROR reader | not a supported hypermedia type in this tree | no | rejected |

The two picks are the most complex of the candidates that are genuinely reachable, both sit in packages
the published fix never touches, and each carries its own copy of the reflective writer (so fixing the
shared helper or the reported deserializer does not cover them).

## What was verified (local, pinned/injected/oracle trees)

- Vulnerability reproduces at the pinned commit through each real entry point (`JsonMapper` + the
  product's public module): Collection+JSON item/template/collection/paged, UBER entity/collection/paged,
  a mapper mix-in, a renamed property addressed by its internal name.
- Injected routes reproduce: HAL-FORMS default/named template and embedded resources; Problem payload.
- Oracle (published shape made partial-safe + siblings): 15/15 security tests pass, 16/16 own functional
  tests pass, 76 project integration tests for the affected media types pass (92/92 functional group).
- Vulnerable tree: 15/15 security tests fail; 92/92 functional tests pass.
- Every check patch applies cleanly to the injected tree with `patch -p1`; each was run against the
  hidden suites: published-only (4 security fail), annotation-only (2 security fail), no-uber (3),
  no-halforms (3), no-problem (1), rename-internal (1), bind-then-restore (3 security fail, functional
  pass), refuse-all (functional fail), set-all (functional fail), hardening (15/15 + 92/92), context
  alternative (15/15 + 92/92). The context alternative keeps the legacy creation helper and filters
  supplied names at the boundary using the mapper-derived metadata; an earlier node-binding variant was
  rejected because it broke project tests for representation-model subclasses.
- Project tests pass at the pinned+injected tree in the image build commands used by the Dockerfiles.

## Gate

- static: PASSED.
- nop: PASSED — 15/15 security tests fail on the vulnerable tree, 92/92 functional tests pass.
- oracle: PASSED — three runs, each reward 1.0, 107/107 tests, identical results.
- patches: PASSED — every security_fail patch leaves only its intended security tests failing with
  all functional tests green; both functional_fail patches break legitimate use; both pass patches
  score 1.0. See build/spring-hateoas-s4/gate_report.patches.json.
- Correction made during gating: the first sf-no-uber.patch omitted the new helper file because it was
  untracked when the diff was taken; regenerated with the file included, re-validated with GNU
  `patch -p1` and a full compile, then the stage was re-run.

## What could not be verified here

- Per-task wording is never perfect: the report intentionally names only the reported format; whether a
  blind solver generalises to the other formats is the trial's question, not something I can run
  (trials are out of scope for this build).
- Spring MVC/WebFlux message-converter routes were not executed; the tests drive the library's mapper
  API (the same modules the converters configure), which is the documented public entry point.
- Current upstream state beyond the fix commit was not inspected (offline/no need).

## Scope note

Nothing outside this advisory was used; no out-of-scope repositories, hidden tests or reference fixes
were consulted. No secrets or credentials were read.
