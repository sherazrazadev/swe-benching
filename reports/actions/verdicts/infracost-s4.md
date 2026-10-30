# `infracost-s4`: REJECTED

**Why:** solved by deepseek.

- Scanning a Terraform project supplied by someone else can make Infracost send the operator's configured Terraform Cloud or registry credential to a host named inside that project.
- CWE-522, Go, https://github.com/infracost/infracost
- Batch 20, [run 40876820128](https://github.com/sherazrazadev/swe-benching/actions/runs/40876820128) · [results branch](https://github.com/sherazrazadev/swe-benching/tree/runs/40876820128)
- Trials: DeepSeek 0.5 0.75 1 / MiMo 0 0 0.9167

## Fairness review: ERROR: no FAIRNESS.md

No review written.

## Audits of the failing runs (0/5 trustworthy)

| Model | Reward | Trustworthy | Attribution | Auditor's summary |
|---|---|---|---|---|
| [deepseek](../audits/infracost-s4-deepseek-r1-20261030-071431-n001/POSTMORTEM.md) | 0.5 | None | not audited () |  |
| [deepseek](../audits/infracost-s4-deepseek-r2-20261030-085152-n001/POSTMORTEM.md) | 0.75 | None | not audited () |  |
| [mimo](../audits/infracost-s4-mimo-r1-20261030-071443-n001/POSTMORTEM.md) | 0 | None | not audited () |  |
| [mimo](../audits/infracost-s4-mimo-r2-20261030-085321-n001/POSTMORTEM.md) | 0 | None | not audited () |  |
| [mimo](../audits/infracost-s4-mimo-r3-20261030-085243-n001/POSTMORTEM.md) | 0.9167 | None | not audited () |  |
