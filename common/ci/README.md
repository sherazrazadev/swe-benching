# common/ci: builds and trials on GitHub Actions

GitHub-hosted runners (public repo: 4 vCPU, 16 GB, free) run the same scripts as the VM. One runner per task build,
one runner per trial run. Up to `max_parallel` (default 7) runners at once.

| Workflow | What it does |
|---|---|
| `build` | `pipelines/sibling/6-build/run_pipeline.sh` (or `run_stack_pipeline.sh` for `stk-*`) per slug: build, then gate + blind fix. Then, if `trials` is on, runs `trial` on the sound ones |
| `trial` | `common/trial/trial.py <slug> --models <m> --first-run <n> --max-runs 1 --no-verdict` per (task, model, run). Run 1 first; runs 2..N only for tasks no model solved in run 1 |

Both push their results to branch `runs/<run id>` (never to `main`). Harbor job folders (gate-jobs, trial jobs) are only in
the run's artifacts (30 days). Verdicts are not made in CI: they stay with `trial.py` records and `audit_results.py`.

**Inputs:** a slug must have `build/<slug>/BUILD-PROMPT.md` committed (prepare it on the VM/Mac as usual) and no
`build/<slug>/pipeline.log` yet. A trial-only run needs `build/<slug>/.sound` and `tasks/<slug>/` committed, or a
`build_run` id whose `build-<slug>` artifact has them.

**Bring results home (with the Harbor job folders, e.g. for post-run audits):**

```bash
git fetch origin runs/<run id> && git merge origin/runs/<run id>          # repo files
gh run download <run id> -D /tmp/art && python3 -I common/ci/ci.py collect /tmp/art --jobs   # + ~/.tb-graders/cwe/
```

**Runner differences from the VM:** the project root is `/home/mara/cwe-bench` via a symlink (BUILD-PROMPTs name it);
`GATE_GLOBAL_SLOTS=4` (VM 60); builder limit `build_hours` (default 4 h, VM 5 h) because a job stops at 6 h. A build
cut by that cap is re-run on the VM, as in the 2026-10-22 precision_validation rule.

Secrets: `DEEPSEEK_API_KEY` (required), `MIMO_API_KEY` (MiMo trials).
