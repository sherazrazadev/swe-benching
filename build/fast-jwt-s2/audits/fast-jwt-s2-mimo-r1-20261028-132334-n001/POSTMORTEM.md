# Post-run audit: fast-jwt-s2__DqCobPb

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.871.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

Reward 0.871 = 27/31 security tests passed with all functional tests passing (score.py:12-14,64). All four failures come from deliberate design choices in the model's patch that contradict the instruction; they are not test or harness faults. (1) Three detection_cache tests fail because the model refuses an explicit HS256 signer whose key is a genuine public key. Its detectPrivateKeyAlgorithm and performDetectPrivateKeyAlgorithm only honour an explicit HS choice when classify() deems the material a 'secret'/'broken'; otherwise they throw 'Public keys are not supported for signing.' The instruction (instruction.md:25-27) says an application that explicitly chooses a symmetric algorithm 'may use any string material as the shared secret for that choice. That choice is unchanged'. The reference fix (fix.patch:162-168) does this by returning providedAlgorithm for any explicit HS request before the cache. (2) One certificate_chain test fails because the model's isSharedSecretMaterial() treats 'broken' material (a PEM CERTIFICATE header with an unimportable body) as a shared secret. certchain.js therefore still falls back to an HMAC-only verifier keyed by the public certificate text, and the forged token is accepted. The instruction forbids treating material that is not a shared secret as one when the caller made no explicit symmetric choice. The reference throws invalidKey instead. Nothing in the harness looks wrong: no tool calls happened during the grading window, exception_info is null, and the results are complete. The transcript shows no hidden-test access or upstream lookup; the GHSA strings it contains come from the repo's own test file.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| [security/certificate_chain] a certificate that cannot be imported is not a shared secret | fail | genuine-fail | True | True |
| [security/detection_cache] an earlier explicit HMAC use does not let a verified key sign as a secret | fail | genuine-fail | True | True |
| [security/detection_cache] the same holds when the key carries surrounding text | fail | genuine-fail | True | True |
| [security/detection_cache] an earlier refusal does not block a later explicit HMAC use | fail | genuine-fail | True | True |

**Lookup or leak:** None found. The transcript shows only workspace exploration: package.json, CHANGELOG.md, and the repo's own test/verifier.spec.js, which contains a GHSA-gmvf describe block. There is no access to hidden tests and no network or upstream fetch.

**Evidence:**
- instruction.md:25-27 'An application that explicitly chooses a symmetric algorithm may use any string material as the shared secret for that choice. That choice is unchanged'
- instruction.md:18-19 asymmetric material must never be used as a shared secret (applies absent explicit HS choice)
- changes.patch:827-835 detectPrivateKeyAlgorithm only returns providedAlgorithm if isSharedSecretMaterial(classify(key))
- changes.patch:180-184 checkIsCompatibleAlgorithm comment: 'genuine key material is never a shared secret'
- changes.patch:666-668 isSharedSecretMaterial returns true for kind 'broken'
- changes.patch:95-107 certchain uses !isSharedSecretMaterial(classify(cert)) to decide key vs HMAC fallback
- solution/fix.patch:162-168 reference returns providedAlgorithm for any explicit HS request
- solution/fix.patch:17-28 reference throws invalidKey for an unimportable certificate
- tests/security/detection_cache.test.js:12,20,30 require explicit HS256 signing with real public keys to succeed
- tests/security/certificate_chain.test.js:13-16 GARBAGE certificate must not verify forged HMAC token
- grading/results.json: 27/31 security pass, all functional pass, reward 0.871
- run.json timing: tool_calls_during_grading [] , exception_info null

**Recommended action:** Keep the 0.871 reward as a fair measure. The failures are the model's own overreach (refusing explicit HMAC use of genuine key strings) and under-reach (treating unimportable certificate material as a shared secret). Optionally note in the task docs that lines 18-19 and 25-27 of the instruction can look contradictory, since that tension is likely what led the model to override the explicit-HS carve-out.
