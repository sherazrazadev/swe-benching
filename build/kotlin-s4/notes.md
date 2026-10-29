# kotlin-s4 build notes

- Start (UTC): 2026-10-29T05:16:41Z (build/kotlin-s4/start_utc.txt)
- End (UTC): 2026-10-29T05:52:18Z
- Advisory: GHSA-R937-WJX7-W2JP / CVE-2026-53914 (jetbrains/kotlin, CWE-502)
- Pinned commit a1c6e2e1092a34ade533fc8d5f50774c3be50309; published fix
  bf51df665b458fda7c3eaf436c4d88dc119d7ec6. Confirmed the pinned commit is the fix's sole
  parent through the GitHub API.
- Workspace: the kapt subtree (`plugins/kapt/`), sparse checkout of the pinned commit; the module
  under test (`plugins/kapt/kapt-base`) depends only on the Kotlin stdlib and the JDK 8 tools jar,
  so it can be built and its own tests run standalone. Kotlin 2.5.0-Beta2 (the language level the
  source needs) and JUnit platform console 1.12.2 are vendored into both images.

## Levers (one line each)

- T0 (main, how-type, published sink): the incremental-cache readers must accept exactly the value
  classes their producer emits (JDK-internal collections, URI/File, the cache value classes) and
  must refuse everything else while resolving, not after deserializing; `incremental/cache.kt`.
- T1 (injected sibling, scope): a third cache file in the same build directory, read during
  processor discovery (`incremental/processorInfoCache.kt`, wired in `ProcessorLoader.kt`), has a
  different value shape (map + declared-kind enum + `java.lang.Enum`).
- T2 (injected sibling, scope): the stub line-mapping metadata reader
  (`stubs/KaptStubLineInformation.kt`, position class made serializable, writer kept in step in
  `plugins/kapt/kapt-compiler/.../KaptLineMappingCollector.kt`) now reads a serialized object
  payload where the format used to hold only primitives.

Reasons to dismiss, respectively: the exact serialized value set is only visible from the
producer and a post-read type check looks equivalent; it is a smaller cache for a different
feature written to its own file; it is diagnostic metadata next to stub sources, not the
incremental cache, and its format was primitives-only before.

## What was verified

- Local, before Docker: the pinned+injected tree gives 9/9 security tests failing and 9/9
  functional tests passing; the reference fix gives 18/18 passing; all 11 check patches give the
  outcome declared in the manifest.
- Project tests: the whole `org.jetbrains.kotlin.kapt.base.test.incremental` package (41 tests)
  runs at environment-image build time on the pinned+injected tree and must pass; the image build
  fails otherwise. It passed in the final image build.
- End-to-end in the images: a verifier run on an unfixed workspace gives reward 0.0 with
  security 0/9 and functional 9/9; on the reference fix it gives reward 1.0 with 18/18.
- Gate: `static` PASSED; `nop` PASSED; `oracle` PASSED (3 runs, identical, reward 1.0 each);
  `patches` PASSED (11/11 as declared: 6 security_fail with functional green, 3 functional_fail,
  hardening 1.0, alternative 1.0). The blind pass patch and FAIRNESS.md are left for the
  downstream steps as instructed.
- The pinned tree does not contain the published fix's regression tests; the fix commit adds them.

## What could not be verified

- Target-model behaviour: no trials were run (instructed not to), so whether DeepSeek V4.1 Flash
  and MiMo-V2.6-Pro fail all three attempts is unknown at build time.
- The screener's two real Gradle-plugin routes (`ClasspathSnapshot.kt`, `ClasspathAnalyzer.kt`)
  cannot be built or tested in a standalone kapt-base checkout; they were substituted with T1/T2
  and recorded in the register. A read-only look at current upstream shows both now use a
  filtering stream, so they are no longer open upstream.
- `present_in_latest` for the injected siblings is "n/a": they do not exist upstream.
- Whether the GHSA/CVE have a public write-up could not be checked (treated as unknown).

## Fairness notes

- Hidden functional tests read the cache through the manager's `internal` cache field, the same
  way the project's own tests do. A solver who reworks that internal API rather than adding a
  filter could make the hidden suite fail to compile; the report states that existing public entry
  points keep their signatures and behaviour, which covers the entry points but not their internals.
- The module is built at its real Java level (8), so a fix using a Java 17 API does not compile.
  This is visible from the module's build file and from the compile script, but it is an
  environmental constraint a solver must notice.
- The general property ("every file kapt reads back from a project's build outputs") is what makes
  T1/T2 fair; the report never names a file, format or feature.

## Out of scope (one line)

Unfiltered deserialization in other modules (Gradle plugin classpath snapshots, SwiftPM metadata,
Maven plugin, kapt CLI option decoding) is outside this advisory's kapt-base protection and was
not built on.
