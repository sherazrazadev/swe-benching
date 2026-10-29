# sigstore-java-s4 build notes

- start UTC: 2026-10-29T01:45:31Z
- end UTC: 2026-10-29T02:54:04Z
- advisory: GHSA-QQW8-7C2R-JXCH / CVE-2026-48791 (sigstore/sigstore-java, CWE-347)
- track: injected; pattern: B
- slug: sigstore-java-s4

## Pin correction (verified, not taken on trust)

The supplied pin `ae74a3cb6a6fbf02d0272128eda9a3fdf773a70b` is the parent of
`4b7a49ebb1813f5b1ff113bcad63246358222d61`, which the advisory itself identifies as the
commit that *introduced* the regression (PR #1008). The advisory says only version 2.0.0 is
affected. Verified behaviourally with the repo's own production fixtures and the local
production trusted root:

- at `ae74a3cb`: the advisory's own regression fixture
  (`bundle-with-expired-cert.sigstore`, added by fix commit 49c27f1) is **rejected**
  ("Signing time was after certificate expiry") because 1.x still called
  `checkValidity(integratedTime)`;
- at `f6934e57a2cb0cdd432f76a18452a51ccbef6570` (first parent of fix merge
  `b529335728fc5cfb574161b4b3c06859a8a2aa88`, i.e. v2.0.0-119, the last vulnerable state):
  the same fixture is **accepted**.

So the task pins `f6934e57a2cb0cdd432f76a18452a51ccbef6570`, the commit just before the
published fix. The supplied pin would ship a task whose stated flaw does not reproduce (and
the advisory says it is not affected). `4b7a49e` is the introduction, not a fix.

## The one property (written once, before any route was chosen)

A claimed signing time may be used to decide that the signing certificate was valid only if
the verifier has actually verified a cryptographic proof binding that time: a trusted
transparency log's signature over that exact entry time, or a timestamp over the signature
that verifies against a trusted timestamp authority. A time value the data merely carries, or
a signature-like field the verifier skipped, is not proof. When no verified time is
available, verification must refuse.

Every route and injected sibling below falls under that sentence. The report states it once
and never names a path.

## Levers

1. **main, how-type (shape + producer off the check's path).** The signing-time decision in
   `KeylessVerifier.verify` (and the published fix's own version of it) infers "the log signed
   this time" from `signedEntryTimestamp != null`, but `RekorVerifier.verifyEntry` skips the
   signature when the string is empty. Several real producers can carry an empty string: the
   Gson adapter used by `RekorResponse`/`RekorClientHttp`/`RekorEntryFetcher` sets whatever
   string the JSON has, and the injected legacy bundle reader passes it through. The check
   never calls any of those producers, so a model that traces only `verify -> verifyEntry`
   arrives at `!= null` and stops. Reason to dismiss: "the bundle reader drops blank
   signatures, so the verifier only ever sees null".
   - sites: `sigstore-java/src/main/java/dev/sigstore/KeylessVerifier.java:194-198`
     (landing), `.../bundle/Bundle.java:74-84` (check), producers
     `.../rekor/client/RekorResponse.java` (Gson adapter) and `.../bundle/BundleReader.java`.
   - security tests: S2 (legacy reader), S3 (fetched saved response), S4 (public builder).
2. **coupled must-keep-working, how-type.** Entries without a log signature are legitimate
   when a verified RFC3161 timestamp covers the signature (Rekor v2), and a genuine log
   signature whose time is inside the certificate's validity must keep verifying even though
   the certificate is expired *now*. An over-broad "require a non-empty SET" or "reject
   expired certificates" fix breaks legitimate use. Reason to dismiss: the model hardens past
   the property.
   - functional tests: F1 (SET-authenticated bundle, cert expired now), F2 (timestamp-only v2
     bundle), F3 (SET + timestamp), F4 (legacy bundle with an authenticated entry).
3. **injected second implementation, where-type extra.** `DetachedSignatureVerifier`
   (injected, public library API for detached materials) repeats the signing-time decision
   independently and never checks whether the entry signature was verified. Reason to
   dismiss: README says the stable API is only the bundle signer/verifier; this is a compat
   helper. Not touched by the published fix.
   - security tests: S5 (blank signature), S6 (missing signature).
4. **injected legacy reader, how-type extra.** `BundleReader` gains a compat branch for a
   legacy "detached materials" bundle document that carries a Rekor API entry; the entry's
   blank signature is preserved. Reason to dismiss: the documented reader drops blank
   signatures, so "it cannot arrive from a parsed bundle".
   - security test: S2; functional F4 keeps the same dialect working for an authenticated
     entry.

## Sites / routes / input shapes the hidden tests cover

- sites: KeylessVerifier.verify (landing, published fix), Bundle.checkAtLeastOneTimestamp
  (published fix), BundleReader legacy branch (injected), DetachedSignatureVerifier
  (injected).
- routes: (a) ordinary bundle whose authenticated entry time is after certificate expiry;
  (b) bundle assembled from a Rekor entry fetched/parsed from a saved log response; (c)
  bundle built through the public builder; (d) legacy reader document; (e) detached
  verifier with a blank or missing entry signature.
- shapes: signedEntryTimestamp present-but-empty vs absent (null); integratedTime present
  within validity vs absent; timestamps empty vs present; valid SET vs verified timestamp.

## All sibling / route candidates found (screener leads + own search)

Real upstream:
- R1 `RekorVerifier.verifyEntry` skips SET when null/empty (O8). **Dismissed**: v2 entries
  legitimately carry no SET and the project's own RekorVerifierTest requires v2 entries to
  verify; requiring a SET here would break legitimate use, and the method does not itself
  decide signing time. Covered as a coupling, not a test.
- R2 `Bundle.checkAtLeastOneTimestamp` tests only `!= null` (O8). **Kept** as the landing
  check (published fix touches it).
- R3 `RekorEntryFetcher.getEntryFromRekor` filters on `checkValidity(integratedTime)` without
  verifying the SET (O2). **Dismissed as a site**: it is a retrieval/compat helper, it makes
  no verification claim, and its public constructor has no trusted-root keys with which to
  authenticate the entry; the final verifier is covered (S3 drives it).
- R4 `ProtoMutators.toRekorEntry` / `RekorEntry.fromTLogEntryJson` drop empty SETs.
  **Producer, safe**; used as a contrast, not a gap.
- R5 `BundleWriter` round-trip. **Dismissed**: no decision; it does not synthesize a time.
- R6 `BundleVerifier` schema validation. **Dismissed**: no cryptography.
- R7 `KeylessSigner` post-sign verify. **Dismissed**: not an untrusted-input verification
  path.
- R8 `RekorV2ClientHttp` conversion (O8b). **Dismissed**: not wired into keyless
  verification at the pin.

Injected picks (2, the most complex / hardest to find; published fix touches neither):
- I1 legacy detached-materials reader branch in `BundleReader` (kept; reason to skip: the
  documented reader is believed to normalize blank signatures).
- I2 `DetachedSignatureVerifier` public compat implementation (kept; reason to skip:
  non-stable API, not the reported entry point).
- I3 BundleWriter "write integrated_time for v2" branch (O8b): **not picked** — a producer
  without a decision; adds a route of the same concept.
- I4 a second verification wrapper on KeylessVerifier delegating to the same code: **not
  picked** — a planted copy with no independent mechanism.
- I5 a Rekor v2 "inclusion proof is enough" acceptance branch: **not picked** — same concept
  as I2, and it would conflict with the project's own v2 tests.

Why the picks beat the others: I1 is the only candidate that lets the blank-signature shape
arrive through the documented JSON bundle entry point, so the general property is exercised
without the test building the value itself; I2 is a genuinely independent decision point
(second implementation) far from the landing point, with its own plausible dismissal and no
compilation coupling to the main fix. R3/R4/R5/R6/R7/R8 either make no verification decision
or cannot be fixed fairly through a real entry point.

## Fairness and must-keep-working

The property plus the code suffices: `RekorVerifier` already distinguishes empty from null;
`Bundle.checkAtLeastOneTimestamp` and the fix's own `set != null` are the two places to see
the gap. Legitimate magnitudes/flows are named in the report without naming a route:
authenticated-time bundles whose certificate is expired now, timestamp-only bundles, and
legacy bundles with an authenticated entry.

## Verified locally (pinned f6934e5, JDK 21, local trusted roots, no TUF)

- advisory fixture accepted at f6934e5, rejected after the published fix;
- empty-signature entry returned by the entry fetcher and built into a bundle accepted at
  f6934e5 **and after the published fix** — the published fix misses it (uncovered route);
- injected legacy reader: empty-signature document accepted at f6934e5; authenticated document
  accepted before and after the fix;
- injected detached verifier: blank and absent signatures accepted at f6934e5, refused by the
  oracle; authenticated entry accepted before and after;
- v2 timestamp-only bundle and timestamp bundle verify against the staging root; ordinary bundle
  verifies against the production root;
- project tests at pinned+injection (and again with the oracle): BundleReaderTest 11,
  BundleVerifierTest 4, AllRequiredFieldsInBundleTest 1, RekorVerifierTest 12, all passing
  offline; KeylessVerifierTest was not run because it builds its verifier through TUF and needs
  network, which the graded environment does not have;
- hidden suites: nop security 0/6 + functional 5/5; oracle 6/6 + 5/5; every check patch behaves
  as declared (sf-published-only 1/6, sf-no-empty-string 3/6, sf-no-detached 4/6,
  wf-refuse-all 6/6 + 0/5, wf-set-only 6/6 + 4/5, pass-hardening 6/6 + 5/5, pass-alternative
  6/6 + 5/5).

## Gate progress

- static: PASSED.
- nop (real offline verifier, separate container): PASSED — security 0/6, functional 5/5.
- Two verifier-image bugs were found and fixed before nop passed: the JUnit download ran as
  the agent user (`USER root` added) and the clean grading environment had no `java` on PATH
  (`JAVA_HOME`/PATH set in the build command and the group runner).
- oracle: PASSED (3 runs, 11/11 each, reward 1.0).
- patches: PASSED (all 7 checks behave as declared: sf-published-only 1/6 security pass,
  sf-no-empty-string 3/6, sf-no-detached 4/6, wf-refuse-all functional 0/5, wf-set-only
  functional 4/5, pass-hardening 6/6+5/5, pass-alternative 6/6+5/5).

## Could not verify

- whether the advisory's own PoC asset (integrated-time-in-future) verifies against a
  checked-in trusted root; its trust root is not in the conformance repo, so the repo's own
  fix-commit fixture was used instead (same shape, production root, verified offline);
- upstream state after b529335 beyond reading the fix commits;
- no network at grade time by construction (the suites use checked-in resources and local
  files only).
