# `cryptography-s4`: REJECTED

**Why:** solved by deepseek, mimo.

- X.509 path validation can accept a certificate for DNS names that a CA in the chain never permitted, when a wildcard subject alternative name is involved.
- CWE-295, Rust, https://github.com/pyca/cryptography
- Batch 23, [run 40978274281](https://github.com/sherazrazadev/swe-benching/actions/runs/40978274281) · [results branch](https://github.com/sherazrazadev/swe-benching/tree/runs/40978274281)
- Trials: DeepSeek 1 / MiMo 1

## Fairness review: ERROR: no FAIRNESS.md

No review written.

## Audits of the failing runs (0/0 trustworthy)

| Model | Reward | Trustworthy | Attribution | Auditor's summary |
|---|---|---|---|---|
