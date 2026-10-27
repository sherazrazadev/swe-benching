# `comfyui-manager-s3`: PENDING

- Close a policy bypass in ComfyUI-Manager where state a client can write through the host's user-file endpoints decides what the product allows, trusts or runs.
- CWE-420, Python, https://github.com/Comfy-Org/ComfyUI-Manager
- Batch 2, [run 40414311131](https://github.com/sherazrazadev/swe-benching/actions/runs/40414311131) · [results branch](https://github.com/sherazrazadev/swe-benching/tree/runs/40414311131)
- Trials: DeepSeek 0.9 0 0 / MiMo 0 0 0 (no run at 1.0)

## Fairness review: READY (gate_a; human question open (NEEDS_HUMAN_REVIEW: YES, no decision in HUMAN-DECISION.md))

Full review: [comfyui-manager-s3-FAIRNESS.md](comfyui-manager-s3-FAIRNESS.md)

## Audits of the failing runs (0/6 trustworthy)

| Model | Reward | Trustworthy | Attribution | Auditor's summary |
|---|---|---|---|---|
| deepseek | 0.9 | None | not audited () |  |
| deepseek | 0 | None | not audited () |  |
| deepseek | 0 | None | not audited () |  |
| mimo | 0 | None | not audited () |  |
| mimo | 0 | None | not audited () |  |
| mimo | 0 | None | not audited () |  |
