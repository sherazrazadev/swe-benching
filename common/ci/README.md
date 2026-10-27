# common/ci: builds and trials on GitHub Actions

GitHub-hosted runners (public repo: 4 vCPU, 16 GB, free) run the same scripts as the VM. One runner per task build,
one runner per trial run. Up to `max_parallel` (default 7) runners at once.

| Workflow | What it does |
|---|---|
| `build` | `pipelines/sibling/6-build/run_pipeline.sh` (or `run_stack_pipeline.sh` for `stk-*`) per slug: build, then gate + blind fix. Then, if `trials` is on, runs `trial` on the sound ones |
| `trial` | `common/trial/trial.py <slug> --models <m> --first-run <n> --max-runs 1 --no-verdict` per (task, model, run). Run 1 first; runs 2..N only for tasks no model solved in run 1 |

Both push their results to branch `runs/<run id>` (never to `main`). Harbor job folders (gate-jobs, trial jobs) are only in
the run's `jobs-*` artifacts (30 days; dependency folders such as `node_modules`, `.venv`, `target` left out). The
`build-*` / `trial-*` artifacts hold only repo files, so trials and collect download little. If a run's own collect
failed, run the `collect` workflow with its run id. Verdicts are not made in CI: they stay with `trial.py` records and `audit_results.py`.

**Batches and the queue:** every `build` run is a batch recorded on `main` in `reports/actions/` (`README.md` totals and
accepted tasks, `batch-NN.md`, `tasks.tsv`). Leave `slugs` empty to take the next `max_parallel` slugs of
`reports/actions/queue.txt`; turn `chain` on and each batch starts the next when it ends, until the queue is empty
(cancel the running batch to stop). A task is claimed in `tasks.tsv` before it builds and never picked again
(`common/ci/batches.py`).

**Final verdict of accepted tasks (automatic):** after a batch records an accepted task (sound, no run at 1.0), the
`verdict` workflow runs the GUIDE's steps 8-10 on it and `batches.py verdict` decides:

| Result | When | What happens |
|---|---|---|
| ACCEPTED | fairness READY and every failing run audited, none finding a test or instruction fault | recorded |
| REJECTED | a model solved it; or still unfair after one repair; or the repaired task is unsound | recorded |
| REPAIR | fairness NOT_READY or an audit found a fault | `repair` workflow: fairfix (reads `FAIRNESS.md` + `AUDIT-FINDINGS.md`), full re-gate, 3 fresh runs per model, then `verdict` again |
| RERUN | a model has fewer than 3 trustworthy failing runs (e.g. provider refusal) | `repair` workflow, mode rerun: extra runs of that model (up to 6 in all), then `verdict` again |
| pending | an audit or the fairness review is missing | nothing; run the audits, then dispatch `verdict` again |

An open "human review" question in the fairness review does not stop a task: the audits of the actual runs answer it.
The audits need Claude Opus: secret `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN`. Without one, run them locally
(`postmortem.py prepare` / Opus auditor / `record`), push `build/<slug>/audits/<job>/POSTMORTEM.json` to the results
branch, and dispatch `verdict` again. Fairness results and audits are kept on the results branch `runs/<run>`, so a
re-dispatch or a repair does not run them again. Only ACCEPTED / REJECTED reach `reports/actions/` (`README.md`,
`verdicts/<slug>.md`). Trials use the GUIDE's 3 h agent limit (`CWE_AGENT_TIMEOUT_MULT=1.5`).

**Inputs:** a slug must have `build/<slug>/BUILD-PROMPT.md` committed (prepare it on the VM/Mac as usual) and no
`build/<slug>/pipeline.log` yet. A trial-only run needs `build/<slug>/.sound` and `tasks/<slug>/` committed, or a
`build_run` id whose `build-<slug>` artifact has them.

**Bring results home (with the Harbor job folders, e.g. for post-run audits):**

```bash
git fetch origin runs/<run id> && git merge origin/runs/<run id>          # repo files
gh run download <run id> -D /tmp/art && python3 -I common/ci/ci.py collect /tmp/art --jobs   # + ~/.tb-graders/cwe/
```

**Runner differences from the VM:** the project root is `/home/mara/cwe-bench` via a symlink (BUILD-PROMPTs name it);
`GATE_GLOBAL_SLOTS=4` (VM 60; build input `gate_slots`, use 2 for heavy Java/Gradle repos: a 16 GB runner
running out of memory is shut down with no artifact); builder limit `build_hours` (default 4 h, VM 5 h) because a job stops at 6 h. A build
cut by that cap is re-run on the VM, as in the 2026-10-22 precision_validation rule.

Secrets: `DEEPSEEK_API_KEY` (required), `MIMO_API_KEY` (MiMo trials).
