# `fast-jwt-s2`: REJECTED

**Why:** solved by deepseek.

- A public key stored with a comment line is used as an HMAC secret, so a token anyone can forge is accepted.
- CWE-347, JavaScript, https://github.com/nearform/fast-jwt
- Batch 9, [run 40627768818](https://github.com/sherazrazadev/swe-benching/actions/runs/40627768818) · [results branch](https://github.com/sherazrazadev/swe-benching/tree/runs/40627768818)
- Trials: DeepSeek 1 / MiMo 0.871

## Fairness review: READY

Full review: [fast-jwt-s2-FAIRNESS.md](fast-jwt-s2-FAIRNESS.md)

## Audits of the failing runs (1/1 trustworthy)

| Model | Reward | Trustworthy | Attribution | Auditor's summary |
|---|---|---|---|---|
| [mimo](../audits/fast-jwt-s2-mimo-r1-20261028-132334-n001/POSTMORTEM.md) | 0.871 | True | model-failed (medium) | Reward 0.871 = 27/31 security tests passed with all functional tests passing (score.py:12-14,64). All four failures come from deliberate design choices in the model's patch that contradict the instruction; they are not test or harness faults. (1) Three detection_cache tests fail because the model refuses an explicit HS256 signer whose key is a genuine public key. Its detectPrivateKeyAlgorithm and performDetectPrivateKeyAlgorithm only honour an explicit HS choice when classify() deems the material a 'secret'/'broken'; otherwise they throw 'Public keys are not supported for signing.' The instruction (instruction.md:25-27) says an application that explicitly chooses a symmetric algorithm 'may use any string material as the shared secret for that choice. That choice is unchanged'. The reference fix (fix.patch:162-168) does this by returning providedAlgorithm for any explicit HS request before the cache. (2) One certificate_chain test fails because the model's isSharedSecretMaterial() treats 'broken' material (a PEM CERTIFICATE header with an unimportable body) as a shared secret. certchain.js therefore still falls back to an HMAC-only verifier keyed by the public certificate text, and the forged token is accepted. The instruction forbids treating material that is not a shared secret as one when the caller made no explicit symmetric choice. The reference throws invalidKey instead. Nothing in the harness looks wrong: no tool calls happened during the grading window, exception_info is null, and the results are complete. The transcript shows no hidden-test access or upstream lookup; the GHSA strings it contains come from the repo's own test file. |
