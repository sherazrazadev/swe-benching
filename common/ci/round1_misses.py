#!/usr/bin/env python3
"""Write build/<slug>/ROUND1-MISSES.md (input for pipelines/sibling/upgrade/run_trapstack.sh) from a run's
jobs-trial-<slug>-* artifacts: which hidden tests each graded run failed.

    python3 -I common/ci/round1_misses.py <artifact dir> <slug> <out.md>
"""
import glob, io, json, os, sys, tarfile

art, slug, out = sys.argv[1:4]
rows = []
for tgz in sorted(glob.glob(os.path.join(art, "**", f"jobs-trial-{slug}-*.tgz"), recursive=True)):
    run = os.path.basename(tgz)[len(f"jobs-trial-{slug}-"):-4]          # e.g. deepseek-r1
    with tarfile.open(tgz) as t:
        names = [n for n in t.getnames() if n.endswith("evidence/grading/results.json")]
        rew = [n for n in t.getnames() if n.endswith("evidence/grading/reward.json")]
        if not names:
            continue
        res = json.load(t.extractfile(names[-1]))
        reward = "?"
        if rew:
            try:
                reward = json.load(t.extractfile(rew[-1])).get("reward", "?")
            except Exception:
                pass
    fails = {g: [k.split("::")[-1] for k, v in tests.items() if v != "pass"]
             for g, tests in res.items() if isinstance(tests, dict)}
    rows.append((run, reward, fails, {g: len(t) for g, t in res.items() if isinstance(t, dict)}))
if not rows:
    sys.exit(f"no graded runs with results.json for {slug} under {art}")
with open(out, "w") as f:
    f.write(f"# Round 1 trial evidence: {slug}\n\nWhich hidden tests each graded round-1 run FAILED.\n\n")
    f.write("| Run | Reward | Failed tests |\n|---|---|---|\n")
    for run, reward, fails, n in rows:
        cell = "; ".join(f"{g} {len(v)}/{n[g]}: " + ", ".join(v) for g, v in fails.items() if v) or "none (solved)"
        f.write(f"| {run} | {reward} | {cell} |\n")
    f.write("\nKeep the traps the model that failed every run keeps missing; add 2-3 new real traps of the kinds "
            "common/builder/BRIEF-trap-stack.md lists for the model that solved it.\n")
print(f"wrote {out}: {len(rows)} runs")
