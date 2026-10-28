# GitHub Actions batches

Builds and trials run on GitHub-hosted runners (`.github/workflows/build.yml`), 7 tasks per batch. With `chain` on, each batch starts the next one from `queue.txt` when it ends; a task listed in `tasks.tsv` is never picked again.

**ACCEPTED** = gate sound, both models failed all 3 runs, every failing run audited as the model's own failure (Claude Opus, `common/audit/postmortem.py`) and the fairness review READY (DeepSeek, `pipelines/sibling/9-fairness`), decided automatically. **REJECTED** = a model solved it, the owner dropped it, or it was still unfair after one repair (fairfix, re-gate and fresh trials). **in final checks** = passed the trials; audits, fairness, a repair or extra runs still under way, nothing recorded yet.

## Totals (53 tasks)

| ACCEPTED | REJECTED | unsound | running |
|---|---|---|---|
| 1 | 36 | 4 | 12 |

## Batches

| Batch | Started | Tasks | Accepted | Rejected | In final checks | Unsound / gate | Build failed | Runs |
|---|---|---|---|---|---|---|---|---|
| [1](batch-01.md) | 2026-10-26T20:05Z | 1 | 0 | 1 | 0 | 0 | 0 | [40392574291](https://github.com/sherazrazadev/swe-benching/actions/runs/40392574291) |
| [2](batch-02.md) | 2026-10-26T22:41Z | 7 | 1 | 4 | 0 | 1 | 1 | [40414311131](https://github.com/sherazrazadev/swe-benching/actions/runs/40414311131) |
| [3](batch-03.md) | 2026-10-27T01:40Z | 1 | 0 | 1 | 0 | 0 | 0 | [40433928167](https://github.com/sherazrazadev/swe-benching/actions/runs/40433928167) |
| [4](batch-04.md) | 2026-10-27T09:45Z | 7 | 0 | 6 | 0 | 1 | 0 | [40483249820](https://github.com/sherazrazadev/swe-benching/actions/runs/40483249820) |
| [5](batch-05.md) | 2026-10-27T13:42Z | 2 | 0 | 2 | 0 | 0 | 0 | [40514332361](https://github.com/sherazrazadev/swe-benching/actions/runs/40514332361) |
| [6](batch-06.md) | 2026-10-27T19:08Z | 6 | 0 | 6 | 0 | 0 | 0 | [40566307793](https://github.com/sherazrazadev/swe-benching/actions/runs/40566307793) |
| [7](batch-07.md) | 2026-10-27T22:22Z | 6 | 0 | 4 | 1 | 1 | 0 | [40594259349](https://github.com/sherazrazadev/swe-benching/actions/runs/40594259349) |
| [8](batch-08.md) | 2026-10-28T00:04Z | 1 | 0 | 1 | 0 | 0 | 0 | [40606332971](https://github.com/sherazrazadev/swe-benching/actions/runs/40606332971) |
| [9](batch-09.md) | 2026-10-28T03:37Z | 6 | 0 | 6 | 0 | 0 | 0 | [40627768818](https://github.com/sherazrazadev/swe-benching/actions/runs/40627768818) |
| [10](batch-10.md) | 2026-10-28T07:00Z | 6 | 0 | 5 | 0 | 1 | 0 | [40647352109](https://github.com/sherazrazadev/swe-benching/actions/runs/40647352109) |
| [11](batch-11.md) | 2026-10-28T14:57Z | 6 | 0 | 0 | 6 | 0 | 0 | [40711090816](https://github.com/sherazrazadev/swe-benching/actions/runs/40711090816) |
| [12](batch-12.md) | 2026-10-28T16:15Z | 6 | 0 | 0 | 6 | 0 | 0 | [40724061049](https://github.com/sherazrazadev/swe-benching/actions/runs/40724061049) |

## Accepted tasks (1)

| Task | Batch | CWE | Language | Repo | DeepSeek | MiMo | What it is |
|---|---|---|---|---|---|---|---|
| [`jenkins-s3`](verdicts/jenkins-s3.md) | 2 | CWE-502 | Java | https://github.com/jenkinsci/jenkins | 0.6 0.6 0.6 | 0 0 0 | A submitted configuration document can make the controller instantiate and keep objects of a type the configured setting does not hold, and can recreate internal request-routing and plugin objects. |

Files: `RESULTS.md` (each accepted task: what it is, how the models failed, why it is fair; task files in `tasks/<slug>/`), `tasks.tsv` (one row per task attempt), `batch-NN.md` (per batch), `verdicts/` (final verdict of each accepted task), `audits/` (every failing run's audit), `queue.txt` (what to build next).
