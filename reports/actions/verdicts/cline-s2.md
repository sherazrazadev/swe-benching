# `cline-s2`: REJECTED

**Why:** solved by deepseek.

- A local coding assistant's browser-facing services accept commands from any web page, letting an unrelated site drive the local runtime.
- CWE-346, TypeScript, https://github.com/cline/cline
- Batch 6, [run 40566307793](https://github.com/sherazrazadev/swe-benching/actions/runs/40566307793) · [results branch](https://github.com/sherazrazadev/swe-benching/tree/runs/40566307793)
- Trials: DeepSeek 0 0 1 / MiMo 0.75 0.9583 0.75

## Fairness review: READY

Full review: [cline-s2-FAIRNESS.md](cline-s2-FAIRNESS.md)

## Audits of the failing runs (0/5 trustworthy)

| Model | Reward | Trustworthy | Attribution | Auditor's summary |
|---|---|---|---|---|
| [deepseek](../audits/cline-s2-deepseek-r1-20261028-020649-n001/POSTMORTEM.md) | 0 | None | not audited () |  |
| [deepseek](../audits/cline-s2-deepseek-r2-20261028-040847-n001/POSTMORTEM.md) | 0 | None | not audited () |  |
| [mimo](../audits/cline-s2-mimo-r1-20261028-020745-n001/POSTMORTEM.md) | 0.75 | None | not audited () |  |
| [mimo](../audits/cline-s2-mimo-r2-20261028-040903-n001/POSTMORTEM.md) | 0.9583 | None | not audited () |  |
| [mimo](../audits/cline-s2-mimo-r3-20261028-040823-n001/POSTMORTEM.md) | 0.75 | None | not audited () |  |
