# netty-s4 — build notes

- Start UTC: 2026-10-30T11:29:20Z
- End UTC: 2026-10-30T12:34:22Z

## Levers (one line each)
- T1 (HOW-type, coupled must-keep-working + shape): an answer must be bound by issuer name/key
  hash *and* serial to the presented certificate; the digest algorithm is the responder's choice,
  so the binding must be recomputed with the answer's own algorithm, and an authorized delegated
  responder stays legitimate — `handler-ssl-ocsp/.../OcspClient.java:243-261` (pinned landing,
  published fix).
- T2 (where-type extra, injected second implementation): a public helper for answers obtained out
  of band checks only the serial — `handler-ssl-ocsp/.../OcspResponseValidator.java:46-90`.
- T3 (HOW-type, injected producer off the check's path): a response cache keyed by responder URL
  returns a stored answer for another certificate — `handler-ssl-ocsp/.../OcspClient.java:149-155`.

The one general property: an OCSP answer is accepted as evidence about a certificate only if it
is bound to that certificate (issuer name/key hash + serial) and signed by the issuer or an
authorized responder; this holds for every answer the client accepts, however it reaches the
client, including one obtained earlier. T1/T2/T3 each fall under it as written.

## Why these levers (candidate list and picks)
All sibling sites/routes found at the pinned commit (screener leads + my search):
1. `OcspClient.validateResponse` (published landing) — picked (T1).
2. `OcspServerCertificateValidator` consumes `getResponses()[0]` — protected once the client check
   is fixed; a second check here is the alternative *fix* layer, not a separate gap — used for
   `pass-alt-sink.patch` / `pass-hardening.patch`, not a lever.
3. `OcspClient.validateSignature` — only a signature/chain decision, no certificate binding; a
   public `validate(BasicOCSPResp, X509Certificate)` that also checks the CertID is injection room,
   but the existing method has no CertID inputs, so it cannot be the acceptance decision — not used.
4. `OcspClientHandler` (abstract stapled-OCSP hook) — the library leaves `verify()` to the user; a
   concrete default would need `ReferenceCountedOpenSslEngine.getOcspResponse()`, i.e. native
   OpenSSL, which cannot be exercised deterministically offline — not used.
5. `example/.../OcspClientExample.java:227-246` stapled validation, serial-only — real upstream,
   still serial-only in current upstream (2cf45cb), but `ExampleOcspClientHandler` is a private
   static nested class with no public entry point — registered, not built.
6. `example/.../OcspServerExample.java:96-112` server-side staple validation, serial-only — real
   upstream, still serial-only in current upstream, but demo `main()` with a null private key and
   no public entry point — registered, not built.
7. A public out-of-band helper (injected) — picked (T2): the most complex remaining sibling, covered
   by the property, reachable through a public API, with a plausible reason to dismiss (convenience
   API, not the query path; it already checks the serial).
8. A response cache in the client (injected) — picked (T3): a producer off the check's path; a fix
   placed only in `validateResponse` never sees a cache hit. Reason to dismiss: the stored answer was
   validated before storage.
9. A second server-side copy / a second delegated-responder variant — dropped as more routes of one
   concept (rule: no more routes of one concept).
T2 and T3 were picked over 5/6 because 5/6 have no reachable entry point, and over 9 because 9 adds
no new concept. T1 provides the coupled-value (digest algorithm, delegated responder) and shape
(the certificate identifier's issuer part) difficulty; T2 tests scope; T3 tests the path a fix
that lives only in the reported method never covers.

## Verified
- Pinned tree + injection, offline loopback harness (local TLS server + local OCSP responder):
  security 0/4, functional 11/11.
- Oracle: security 4/4, functional 11/11, run twice identically.
- Every check patch was run through the full hidden suite locally; raw logs in
  `~/.tb-graders/cwe/work/netty-s4/check-results.txt` and `check-results2.txt`:
  - sf-reported-only: security 2/4 (reuse + out-of-band), functional 11/11.
  - sf-no-issuer-binding: security 2/4 (both answers naming another issuer), functional 11/11.
  - sf-no-out-of-band: security 3/4, functional 11/11.
  - sf-no-cache: security 3/4, functional 11/11.
  - ff-require-issuer-signer: security 4/4, functional 9/11 (delegated + included-chain).
  - ff-sha1-rebuild: security 4/4, functional 10/11 (non-SHA-1 answer rejected).
  - ff-reject-all / ff-wrong-certificate: security 3/4, functional 6/11.
  - pass-alt-sink / pass-hardening: security 4/4, functional 11/11.
- The image needs a C toolchain: the reactor's `netty-transport-native-unix-common` module runs
  `make` while building, so `build-essential` is installed in both images. The environment image
  was built successfully with it (native module included).
- The two project tests for this area that do not need the network
  (`OcspClientTest#validateSignatureWithIncludedChainSucceeds`,
  `#validateSignatureWithInvalidChainThrows`) are copied into the functional group and pass.
- Current upstream (2cf45cb, read-only): the library check is still present; both example routes
  are still serial-only.
- The pinned commit is the direct parent of the published fix and does not contain its regression
  test.

## Gate
- static: PASSED.
- nop: PASSED (security 0/4, functional 11/11).
- oracle: PASSED (3 trials, reward 1.0, identical results).
- patches: PASSED (10/10): sf-no-issuer-binding, sf-no-out-of-band, sf-no-cache and sf-reported-only
  leave only security tests failing with all functional passing; ff-require-issuer-signer,
  ff-sha1-rebuild, ff-reject-all and ff-wrong-certificate break functional tests; pass-hardening and
  pass-alt-sink both score 1.0. The blind patch and FAIRNESS.md are produced by the pipeline after
  this build and are intentionally absent.

## Not verified / limits
- The other project tests for this area need the network (`simpleOcspQueryTest`,
  `OcspServerCertificateValidatorTest`, `testsuite-jpms/OCSPTest`) or native OpenSSL (`OcspTest`);
  they were not run and are not part of grading.
- The two example routes cannot be reached by a behavioural test (private nested handler / demo
  main), so they are registered but not built.
- The published fix also carries unrelated OCSP changes (response-object type handling, a response
  timeout, read buffering until validation completes). They are outside this advisory's CertID
  binding and were not adopted; the oracle keeps the CertID binding only.
- Repository size was not measured.

## Out of scope noticed
- The published fix commits also contain unrelated codec changes from other advisories (bzip2, DNS,
  HAProxy, HTTP/1-3, Redis, STOMP, XML, CORS, multipart, SPDY); not examined.
