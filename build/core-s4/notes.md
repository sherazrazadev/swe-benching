# core-s4 build notes

Start: 2026-10-29T00:48:47Z (pipeline driver). Build work started 2026-10-29T00:49Z.
End: 2026-10-29T01:36Z.

Slug: `core-s4`. Advisory: GHSA-9RJG-X2P2-H68H / CVE-2026-54164, api-platform/core,
pinned `92e03dfa386a273033c483520671b437f44df76b`, published fix
`6bcbeb2dbee53db5bb9b4b8e343bffdf7732de1e` (the pinned commit is the fix's direct parent).
Track: injected. Pattern: B.

## Security property (one, stated once in instruction.md)

Whenever the API resolves a client-supplied reference into an object for a place that declares a
resource type, the resolved object must be an instance of that declared type (a subtype is
acceptable); any other type is refused with a client error and no write. It holds however the
reference is carried and in every representation.

## Levers (one line each)

1. `t1_jsonapi_linkage` - HOW / pattern B real upstream route. The JSON:API normalizer's own
   `denormalizeRelation` override resolves relationship linkage `{type,id}` with
   `getResourceFromIri` and never compares the result with the declared relation class. The
   published fix touches only `AbstractItemNormalizer`. Reason to dismiss: the transport declares a
   `type` member, so it looks type-checked; it is another composer package. Source:
   `src/JsonApi/Serializer/ItemNormalizer.php:211-235`. This is the main lever.
2. `t2_whole_document_reference` - HOW / pattern A far site + shape. The item being written may
   itself be supplied as a bare reference (the whole-document branch at
   `src/Serializer/AbstractItemNormalizer.php:230`). A relation-only guard (the method the report
   names) leaves it open. Reason to dismiss: a body that is only a reference looks like a read, and
   the report's example is a relation field.
3. `t3_nested_node_reference` - HOW / injected sibling, shape. INJECTED in
   `src/JsonLd/Serializer/ItemNormalizer.php` (new `denormalizeRelation` override, line 198):
   JSON-LD clients may send a relation as a node-reference object `{"@id": ...}`; the override
   resolves it with no class check, so the abstract guard is never reached. Reason to dismiss: the
   file already handles `@id` for whole documents with the converter's operation guard, and nested
   documents read as the serializer's own concern. The published fix never touches the file.
4. `t4_legacy_reference_object` - HOW / injected sibling, shape. INJECTED in
   `src/Serializer/ItemNormalizer.php` (new `denormalizeRelation` override, line 82): a legacy
   reference object `{"iri": ...}` is resolved with no class check. Reason to dismiss: the abstract
   method explicitly rejects nested documents ("use IRIs instead"), so arrays look unsupported; and
   legacy compatibility code looks unrelated to the advisory. The published fix never touches the
   file.
5. `t5_polymorphic_coupling` - HOW / coupled must-keep-working value. A relation declared as an
   abstract resource type must still accept a concrete subtype IRI. The project resolves the
   declared class through `ResourceClassResolver` (`src/Metadata/Resource/ResourceClassResolver.php:60-62`),
   so a check that compares the effective class for equality reads as correct but rejects the
   polymorphic relations the resolver exists to support. Functional tests only.

Every route falls under the one property as written; none is described in the instruction.

## Candidate sibling sites/routes found (full list) and why the picks won

Real upstream sinks for `getResourceFromIri` that take client data:

- `src/JsonApi/Serializer/ItemNormalizer.php:211-235` (JSON:API linkage override) - **PICKED (t1)**:
  real, untouched by the fix, another package, and the `type` member gives the strongest reason to
  dismiss. Verified exploitable over HTTP.
- `src/Serializer/AbstractItemNormalizer.php:230` (whole-document reference) - **PICKED (t2)**: the
  published fix's own far site, a shape a plausible relation-only check mishandles. Verified.
- `src/Serializer/ItemNormalizer.php:81` / `:98` (body `id` -> OBJECT_TO_POPULATE) - rejected:
  probed over HTTP with a PUT carrying a foreign-class `id`; the write pipeline already provides the
  object from the URI, and Symfony's `instantiateObject` rejects a wrong-class `OBJECT_TO_POPULATE`.
  No observable type confusion.
- `src/JsonApi/Serializer/ItemNormalizer.php:167-171` (`data.id` -> OBJECT_TO_POPULATE) - rejected:
  same probe; no observable confusion.
- `src/JsonLd/Serializer/ItemNormalizer.php:181` (`@id` -> OBJECT_TO_POPULATE) - rejected: it
  already passes the root operation to the converter, whose `is_a` guard fires. Verified safe.
- `src/State/ParameterProvider/IriConverterParameterProvider.php:43-54` - rejected: real code with no
  class check, but the declared type is only the parameter's `nativeType`, which the provider and
  the rest of the pipeline never treat as a resource-type declaration; making it a security
  requirement would rest on an inference a careful engineer could reasonably reject. Not fair.
- `src/Laravel/Routing/IriConverter.php:67-89` - rejected: the converter's missing guard is a
  lower-level API; the serializer callers never pass an operation, and reaching it through a real
  Laravel entry point would need a second application stack for no additional judgement.
- `src/GraphQl/State/Provider/ReadProvider.php:66`, `src/Doctrine/Common/Filter/SearchFilterTrait.php:125`,
  `src/Doctrine/Orm/Filter/SearchFilter.php:233`, `src/Elasticsearch/Filter/AbstractSearchFilter.php:158` -
  rejected: read-side, explicitly outside this write-side advisory.
- `src/Laravel/workbench/app/Http/Requests/StoreSlotRequest.php:40` - rejected: a workbench request
  handler, not product infrastructure, and another stack.

Injected candidates (product code a maintainer could plausibly have written):

- JSON-LD node-reference carrier in the JSON-LD normalizer - **PICKED (t3)**: realistic for a
  JSON-LD client, reachable through the normal HTTP write, in a package the fix never touches, and a
  shape (array instead of string) that the abstract method's guard misses.
- Legacy `{"iri": ...}` carrier in the plain-JSON normalizer - **PICKED (t4)**: mirrors the
  project's existing legacy plain-identifier denormalizers; a second file in the same package, so a
  solver who fixes only the abstract method leaves it open. Kept distinct from t3 by making the
  functional tests preserve each carrier (deleting either breaks a functional test).
- A second `IriConverter` implementation / a Laravel mirror - rejected (see above).
- A request-handler or state-provider sibling - rejected: request handlers get read wholesale and
  the producer would not be infrastructure.
- More formats (HAL input) - rejected: a large feature, and a protocol variant of one concept.

Picks beat the alternatives on: real/unmodified upstream or realistic injected code, distance from
the landing point (different package or file), a distinct reason to dismiss, and a coupled
functional behaviour that an over-broad or deleting fix breaks.

## Verified

- Built the project at the pinned commit with a frozen `composer.lock` (generated on this machine,
  PHP 8.3, Symfony serializer/property-info/property-access/type-info 7.3.10, mercure 0.7.2/bundle
  0.4.3, prophecy 1.20.0) and booted the project's real functional test kernel (ApiTestCase).
- Reproduced every tested route over HTTP on the pinned+injected tree: single/collection relation
  (JSON-LD and plain JSON), whole-document reference, JSON:API to-one/to-many/forged type, JSON-LD
  node reference, plain-JSON legacy reference object. All return 201 and the write processor sees
  the foreign object.
- With the reference fix (`solution/fix.patch`): all 12 security tests pass and all 11 functional
  tests pass, both locally and through JUnit scoring.
- Wrong-fix matrix (local, all through the hidden suites):
  - miss-whole: 2 security fail, 0 functional fail (security_fail)
  - miss-relation: 3 security fail, 0 functional fail (security_fail)
  - miss-jsonapi: 3 security fail, 0 functional fail (security_fail)
  - miss-nested: 2 security fail, 0 functional fail (security_fail)
  - miss-legacy: 2 security fail, 0 functional fail (security_fail)
  - equality (class equality instead of subtypes): 0 security fail, 2 functional fail (functional_fail)
  - refuse-all: 2 security fail, 5 functional fail (functional_fail)
  - crash (RuntimeException, HTTP 500): 5 security fail, 0 functional fail (security_fail)
  - adjacent-api (pass the root operation to the converter): 0 security fail, 9 functional fail
    (functional_fail)
  - alt (converter-level check using the denormalization context's `resource_class`): reward 1.0
  - hardening (oracle + converter-level defensive check): reward 1.0
- `present_in_latest` for the JSON:API linkage route: the `origin/4.1` branch tip still resolves
  the linkage id with no class check; `origin/5.0` (main) refactored the override away, so the exact
  route is gone there.
- Polarity: `TestSuiteConfigCache` and the PSR-6 resource-name cache mean the suite must run with
  `variables_order=EGPCS` (so `APP_PHPUNIT` reaches `$_ENV` and the hidden resource list is used)
  and from a clean functional cache; both are set in `tests/test.sh`. Without them every route 404s
  and the security suite would pass for the wrong reason.

## Gate results (Harbor, separate verifier, offline, uid-1000 grading)

- static: PASSED (conforming; no leaks; only the later `blind` patch and `FAIRNESS.md` remain).
- nop: PASSED - 12/12 security tests fail on the vulnerable+injected image, 11/11 functional pass.
- oracle: PASSED - 3/3 runs, reward 1.0 each, identical security and functional maps.
- patches: PASSED - 11/11 declared checks behaved as declared:
  miss-whole 0.8333 (2 security fail), miss-relation 0.75 (3), miss-jsonapi 0.75 (3),
  miss-nested 0.8333 (2), miss-legacy 0.8333 (2), crash 0.5833 (5 security fail),
  equality 0.0 (2 functional fail), refuse-all 0.0 (5 functional fail),
  adjacent-api 0.0 (9 functional fail), alt 1.0, hardening 1.0.
  `blind.patch` is produced by the after-trial step and is skipped while absent.
- The environment image was also exercised directly: 12 security fail / 11 functional pass, and
  `tests/Functional/Parameters/IriProviderParameterTest.php` passes (2 tests, 5 assertions).

## Could not verify / caveats

- The project's affected-area unit tests `src/Serializer/Tests/AbstractItemNormalizerTest.php`
  (3 failures) and `src/JsonApi/Tests/Serializer/ItemNormalizerTest.php` (1 error) are stale at the
  pinned commit: they are missing prophecy stubs that upstream main later added. The same failures
  reproduce on a clean pinned checkout with the frozen dependency set and are unrelated to the
  task. They are therefore not graded; a project functional test
  (`tests/Functional/Parameters/IriProviderParameterTest.php`) passes in the image and the hidden
  behavioural suite covers the area.
- The image build (pecl mongodb, composer install, node, Claude Code) and all four Harbor gate stages
  ran on this machine; the results are above.
- Whether the exact JSON:API route is reachable in future releases: unknown beyond the branch
  inspection above.
- The screener's object-to-populate routes are not exploitable through the HTTP write pipeline in
  this test app (probed); a different downstream embedding of the serializer could differ.
- Repository size in MB was not measured.

## Out of scope noticed

- GraphQL `ReadProvider` (read-side class mismatch, Query only) and Doctrine/Elasticsearch search
  filters resolve IRIs with no class check; read-side, outside this advisory, not built on.
