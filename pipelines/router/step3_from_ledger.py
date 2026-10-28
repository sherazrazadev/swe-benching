#!/usr/bin/env python3
"""Step 3 for GitHub Actions: route solved stacked tasks to sibling builds, reading the scale-run ledger.

    python3 -I pipelines/router/step3_from_ledger.py [--ledger reports/scale-run/ledger.tsv]
    LANE_RECS=pipelines/router/out/step5/screener LANE_PIPE=pipelines/router/out/step5/pipeline LANE_SUFFIX=s5 \
      python3 -I pipelines/sibling/4-select/lane.py prepare deepseek

Same rule as route.py step3 (one sibling task per repo whose stacked task a model solved; no repo that already
has a sibling build), but the solved set comes from the ledger TSV instead of build/audit/ledger.md (VM only),
and the screens from the committed DeepSeek screens (out/screener + out/screener-ds-rescreen, as
select_ds_fullpool.sh builds screener-ds). Output lane: out/step5, suffix s5 (distinct from the VM's s3 names).
"""
import argparse, csv, glob, json, os, re, shutil, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SO = ROOT / "pipelines/stacking/out"
OUT = ROOT / "pipelines/router/out/step5"


def norm(repo):
    p = str(repo or "").lower().rstrip("/").replace(".git", "").replace("https://github.com/", "").split("/")
    return "/".join(p[-2:]) if len(p) >= 2 else "/".join(p)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ledger", default="reports/scale-run/ledger.tsv")
    a = ap.parse_args()
    solved = {}
    for r in csv.DictReader(open(ROOT / a.ledger), delimiter="\t"):
        if r["task"].startswith("stk-") and ("SOLVED" in r["deepseek"] or "SOLVED" in r["mimo"]):
            solved[r["task"]] = r["verdict"]
    repo_of = {}
    for f in glob.glob(str(SO / "*.tsv")):
        for r in csv.DictReader(open(f), delimiter="\t"):
            if r.get("slug", "").startswith("stk-") and r.get("repo"):
                repo_of[r["slug"]] = norm(r["repo"])
    screens = {}
    for src in (SO / "screener", SO / "screener-ds-rescreen"):     # later wins: re-screens replace first screens
        for f in sorted(src.glob("*.json")):
            if f.name.startswith(("_", ".")) or f.name.endswith(".run.json"):
                continue
            try:
                rec = json.loads(f.read_text())
            except Exception:
                continue
            if "deepseek" in str(rec.get("model", "")).lower():
                screens[norm(rec.get("repo"))] = f
    sibling = set()
    for t in (ROOT / "tasks").glob("*/task.toml"):
        m = re.search(r'^\s*repo\s*=\s*"([^"]+)"', t.read_text(errors="replace"), re.M)
        if m and not t.parent.name.startswith("stk-"):
            sibling.add(norm(m.group(1)))
    taken = set()                                                  # repos any lane already selected
    for sel in glob.glob(str(ROOT / "pipelines/**/selection_*.json"), recursive=True):
        if "/step5/" in sel:
            continue
        try:
            for x in json.load(open(sel)):
                if x.get("repo"):
                    taken.add(norm(x["repo"]))
        except Exception:
            pass
    (OUT / "screener").mkdir(parents=True, exist_ok=True); (OUT / "pipeline").mkdir(parents=True, exist_ok=True)
    sel, seen = [], set()
    for slug, verdict in sorted(solved.items()):
        repo = repo_of.get(slug)
        if not repo:
            print(f"  {slug}: repo unknown (not in pipelines/stacking/out/*.tsv); skipped"); continue
        if repo in seen:
            print(f"  {slug}: {repo} already routed in this run (one sibling task per repo)"); continue
        if repo in sibling or repo in taken:
            print(f"  {slug}: {repo} already has a sibling build or selection; skipped (no duplicates)"); continue
        f = screens.get(repo)
        if not f:
            print(f"  {slug}: {repo} has no DeepSeek screen; skipped (needs a screen first)"); continue
        rec = json.loads(f.read_text()); eid = str(rec.get("entry_id") or f.stem)
        shutil.copy2(f, OUT / "screener" / f"{eid}.json")
        sel.append({"entry_id": eid, "repo": repo, "source": "step3-from-ledger", "from_stacked": slug, "why": verdict})
        seen.add(repo)
        print(f"  {slug}: routed {repo} (screen {f.parent.name}/{f.name})")
    json.dump(sel, open(OUT / "pipeline" / "selection_deepseek.json", "w"), indent=1)
    print(f"step 3 (ledger): {len(sel)} routed -> {(OUT / 'pipeline/selection_deepseek.json').relative_to(ROOT)}")


if __name__ == "__main__":
    main()
