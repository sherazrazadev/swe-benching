# spring-graphql-s4 build notes

Start: 2026-10-29T11:43:49Z (driver record) / builder work began ~11:44Z
End: 2026-10-29T13:08:20Z

## Candidate check (what the input got wrong)

- Pinned commit `3ebad2713f52e04e6dc892b5adb79a29e14f4a1a` is on the 2.0.x line at version
  `2.0.4-SNAPSHOT` (gradle.properties).
- The advisory `GHSA-PX92-Q6RC-6MWV` / `CVE-2026-41699` is real: "Unsafe Deserialization" while
  processing paginated GraphQL queries, fixed in 2.0.4 / 1.4.6 / 1.3.9.
- The advisory (and the screener record) names `5579b6ec` as the fix commit. That commit is
  "Fix Nullness of GraphQL variables values" - ten `@Nullable` annotations, no runtime change, and
  it is not a security fix. The actual fix for the advisory on this line is `e01cd34d`
  ("Provide more flexibility in JsonKeysetCursorStrategy collections types", 2026-04-21), which
  replaced `allowIfBaseType(Map.class)` with an explicit subtype allow-list and shipped in 2.0.4.
  `e01cd34d` is an ancestor of the pinned commit, so the **default Jackson 3 cursor decoder is
  already hardened at the pinned commit**.
- What remains open at the pinned commit is the same weakness on two other real routes, both fixed
  upstream later by `cb45b282` ("Align Jackson pagination configuration", 2026-07-16, gh-1496,
  released in 2.0.5): the Jackson 2 compatibility mapper and the documented application
  configuration in `spring-graphql-docs`. Both were reproduced behaviourally at the pinned commit.
- `task.toml` therefore records `fix_commit = cb45b282...`; the advisory's linked commit is kept in
  `manifest.candidate_corrections` for the record. The oracle is not the advisory-linked commit.

## Levers (one line each)

- T1, real upstream: the Jackson 2 compatibility mapper in `JsonKeysetCursorStrategy` validates the
  declared container type (`allowIfBaseType(Map.class)`), so any Map implementation named in a
  cursor is instantiated. Reason to skip: legacy JSON stack, only used when Jackson 3 is absent.
- T2, real upstream: the product's documented application configuration
  (`KeysetCursorConfiguration`) uses the same base-type rule on the default runtime. Reason to
  skip: sample/docs module, "not the shipped library".
- T3, injected: a versioned cursor-envelope codec (`JsonCursorEncoder`, placed beside the Base64
  encoder) uses a fully permissive validator, and its nested attribute map is a second, nested
  type-id position. Reason to skip: the encoder only wraps a string; the reported decode happens in
  the position strategy.
- T4, coupled value (not a route): ordinary keyset positions carrying Date, Calendar, UUID,
  Number/BigDecimal, java.time values and enums, and positions whose keys are an unmodifiable map,
  must keep round-tripping; an over-broad fix that drops polymorphic typing fails.

## Verified

- All three routes reproduce on the pinned tree through a real paginated GraphQL query resolved by
  the annotated-controller subrange argument resolver: the crafted cursor's class constructor runs
  (T1 raw and base64, T2 base64 on the default runtime, T3 root and nested).
- All three routes are refused after `solution/fix.patch`; the legitimate values above still
  round-trip on every configuration, including the Jackson 2 runtime.
- Full verifier simulation on the pinned tree: reward 0.0, 6/6 security tests fail, 44/44 functional
  tests pass (includes the six project test classes). On the fixed tree: reward 1.0, 50/50.
- Every `checks/` patch was run against the pinned tree and behaved as declared in the manifest:
  the three `miss_*` patches each leave exactly one lever open; `wrong_object_base_type` and
  `check_after_decode` leave the attacks succeeding; `refuse_all`, `disable_feature` and
  `adjacent_api` pass security but break functional; `hardening` and `alt_correct_fix` pass all.
- Project tests ran offline in the built image at the pinned commit and after the fix:
  JsonKeysetCursorStrategyTests, ScrollPositionCursorStrategyTests, RepositoryUtilsTests,
  Base64CursorEncoderTests, SubrangeMethodArgumentResolverTests, SchemaMappingPaginationTests.
- Environment and verifier images build offline-ready (Gradle 9.4.1 + BellSoft JDK 25 + warmed
  dependency cache); the legacy-runtime suites run in a JVM with the `tools.jackson` jars removed.

## Could not verify

- Whether the advisory's linked commit or a private enterprise patch was intended for a different
  branch; the public 2.0.x line already contains the default-path fix at the pinned commit.
- Whether the two remaining routes were known to the advisory authors at disclosure time; upstream
  fixed them in a later "alignment" commit (gh-1496) that is not labelled security.
- "Present in latest" for the real routes: the current upstream main/2.0.x contains the later fix,
  so the weak configuration is no longer present there; this was read from the public repository,
  not from a release binary.

## Gate

- `--only static`: PASSED (re-run on the final tree after the artifacts-exclude fix).
- `--only nop`: PASSED. Trial `spring-graphql-s4-nop-1793278079`: reward 0.0, security 0/6,
  functional 44/44 (the six security tests are the exploits; every functional test passes).
- `--only oracle`: PASSED, three runs, all reward 1.0, security 6/6, functional 44/44, identical
  result sets (`spring-graphql-s4-oracle1/2/3`).
- `--only patches`: PASSED. `miss_jackson2`, `miss_docs`, `miss_encoder` each leave only their own
  lever failing and keep functional 44/44; `wrong_object_base_type` and `check_after_decode` leave
  all six security tests failing with functional 44/44; `refuse_all`, `disable_feature` and
  `adjacent_api` pass security and break functional; `hardening` and `alt_correct_fix` score 1.0.
- An earlier nop run (`...nop-1793277876`) failed on infrastructure caused by the template
  artifacts exclude `"build"`: tar matches it as a leading prefix, so it also dropped `buildSrc/`.
  The exclude list now anchors the build directories (`./build`, `./buildSrc/build`, per-module)
  and the rebuild passed.

## Outside the advisory's own scope (one line)

- The pinned tree already contains the default Jackson 3 regression test added with the earlier
  real fix (`fromJsonToCursorFailsForInvalidTypes`); it does not cover any tested route.
