# GitHub Actions batches

Builds and trials run on GitHub-hosted runners (`.github/workflows/build.yml`), 7 tasks per batch. With `chain` on, each batch starts the next one from `queue.txt` when it ends; a task listed in `tasks.tsv` is never picked again.

**Accepted** = gate sound and both models failed all 3 runs (no run at 1.0). This is the trial outcome; the official verdict is still `common/audit/audit_results.py` plus the failing-run audits and fairness.

## Totals (8 tasks)

| accepted | rejected | unsound |
|---|---|---|
| 4 | 3 | 1 |

## Batches

| Batch | Started | Tasks | Accepted | Rejected | Unsound / gate | Build failed | Other | Runs |
|---|---|---|---|---|---|---|---|---|
| [1](batch-01.md) | 2026-10-26T20:05Z | 1 | 0 | 1 | 0 | 0 | 0 | [40392574291](https://github.com/sherazrazadev/swe-benching/actions/runs/40392574291) |
| [2](batch-02.md) | 2026-10-26T22:41Z | 7 | 4 | 1 | 1 | 1 | 0 | [40414311131](https://github.com/sherazrazadev/swe-benching/actions/runs/40414311131) |
| [3](batch-03.md) | 2026-10-27T01:40Z | 1 | 0 | 1 | 0 | 0 | 0 | [40433928167](https://github.com/sherazrazadev/swe-benching/actions/runs/40433928167) |

## Accepted tasks (4)

| Task | Batch | CWE | Language | Repo | DeepSeek | MiMo | What it is |
|---|---|---|---|---|---|---|---|
| `comfyui-manager-s3` | 2 | CWE-420 | Python | https://github.com/Comfy-Org/ComfyUI-Manager | 0.9 0 0 | 0 0 0 | Close a policy bypass in ComfyUI-Manager where state a client can write through the host's user-file endpoints decides what the product allows, trusts or runs. |
| `langflow-s3` | 2 | CWE-639 | Python | https://github.com/langflow-ai/langflow | 0.9286 0.7857 0.7857 | 0.7143 0 0.9286 | Keep the MCP and file surfaces inside the caller's own account, project and container. |
| `jenkins-s3` | 2 | CWE-502 | Java | https://github.com/jenkinsci/jenkins | 0.6 0.6 0.6 | 0 0 0 | A submitted configuration document can make the controller instantiate and keep objects of a type the configured setting does not hold, and can recreate internal request-routing and plugin objects. |
| `avideo-s3` | 2 | CWE-345 | PHP | https://github.com/WWBN/AVideo | 0 0 0 | 0 0 0 | A forged payment notification can credit a chosen account with a chosen amount through the wallet of a video platform's payment integration. |

Files: `tasks.tsv` (one row per task attempt), `batch-NN.md` (per batch), `queue.txt` (what to build next, in order; add slugs that have `build/<slug>/BUILD-PROMPT.md`).
