# `izpack-zip-path-inj`: REJECTED

**Why:** repair failed: re-gate after the stack: unsound.

- Reject installer target locations that carry a parent-directory segment before any file is created, moved or rewritten.
- CWE-22, Java, https://github.com/izpack/izpack
- Batch 10, [run 40647352109](https://github.com/sherazrazadev/swe-benching/actions/runs/40647352109) · [results branch](https://github.com/sherazrazadev/swe-benching/tree/runs/40647352109)
- Trials: DeepSeek 0.7778 0.5556 0.6667 / MiMo 0.7778 0.7778 1

## Fairness review: -

No review written.

## Audits of the failing runs (0/0 trustworthy)

| Model | Reward | Trustworthy | Attribution | Auditor's summary |
|---|---|---|---|---|
