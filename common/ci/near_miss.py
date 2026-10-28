#!/usr/bin/env python3
"""Print the slugs that qualify for round 2 (repair.yml mode=stack): one model failed all of at least 3 graded
runs, the other model solved it, and the task was never trap-stacked before.

    python3 -I common/ci/near_miss.py slug1,slug2,...
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
out = []
for slug in [s for s in sys.argv[1].split(",") if s]:
    b = ROOT / "build" / slug
    if (b / "trapstack_status.txt").exists() or (b / "pre-harden").exists():
        continue                                   # one round 2 per task; never after a harden
    rew = {}
    for m in ("deepseek", "mimo"):
        f = b / f"trial_detail_{m}.json"
        runs = json.loads(f.read_text()).get("runs", []) if f.is_file() else []
        rew[m] = [float(r["reward"]) for r in runs if r.get("reward") not in (None, "None")]
    failed_all = [m for m, r in rew.items() if len(r) >= 3 and max(r) < 1.0]
    solved = [m for m, r in rew.items() if 1.0 in r]
    if failed_all and solved and set(failed_all).isdisjoint(solved):
        out.append(slug)
print(",".join(out))
