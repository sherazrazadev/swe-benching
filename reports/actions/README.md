# GitHub Actions batches

Builds and trials run on GitHub-hosted runners (`.github/workflows/build.yml`), 7 tasks per batch. With `chain` on, each batch starts the next one from `queue.txt` when it ends; a task listed in `tasks.tsv` is never picked again.

**ACCEPTED** = gate sound, both models failed all 3 runs, every failing run audited as the model's own failure (Claude Opus, `common/audit/postmortem.py`) and the fairness review READY (DeepSeek, `pipelines/sibling/9-fairness`), with any open question decided by the owner. **REJECTED** = a model solved it, or the owner dropped it. **in final checks** = passed the trials; audits, fairness, re-runs or fixes still under way, nothing recorded yet.

## Totals (17 tasks)

| ACCEPTED | REJECTED | in final checks | unsound |
|---|---|---|---|
| 1 | 13 | 1 | 2 |

## Batches

| Batch | Started | Tasks | Accepted | Rejected | In final checks | Unsound / gate | Build failed | Runs |
|---|---|---|---|---|---|---|---|---|
| [1](batch-01.md) | 2026-10-26T20:05Z | 1 | 0 | 1 | 0 | 0 | 0 | [40392574291](https://github.com/sherazrazadev/swe-benching/actions/runs/40392574291) |
| [2](batch-02.md) | 2026-10-26T22:41Z | 7 | 1 | 4 | 0 | 1 | 1 | [40414311131](https://github.com/sherazrazadev/swe-benching/actions/runs/40414311131) |
| [3](batch-03.md) | 2026-10-27T01:40Z | 1 | 0 | 1 | 0 | 0 | 0 | [40433928167](https://github.com/sherazrazadev/swe-benching/actions/runs/40433928167) |
| [4](batch-04.md) | 2026-10-27T09:45Z | 7 | 0 | 6 | 0 | 1 | 0 | [40483249820](https://github.com/sherazrazadev/swe-benching/actions/runs/40483249820) |
| [5](batch-05.md) | 2026-10-27T13:42Z | 2 | 0 | 1 | 1 | 0 | 0 | [40514332361](https://github.com/sherazrazadev/swe-benching/actions/runs/40514332361) |

## Accepted tasks (1)

| Task | Batch | CWE | Language | Repo | DeepSeek | MiMo | What it is |
|---|---|---|---|---|---|---|---|
| [`jenkins-s3`](verdicts/jenkins-s3.md) | 2 | CWE-502 | Java | https://github.com/jenkinsci/jenkins | 0.6 0.6 0.6 | 0 0 0 | A submitted configuration document can make the controller instantiate and keep objects of a type the configured setting does not hold, and can recreate internal request-routing and plugin objects. |

Files: `tasks.tsv` (one row per task attempt), `batch-NN.md` (per batch), `verdicts/` (final verdict of each accepted task), `audits/` (every failing run's audit), `queue.txt` (what to build next).
