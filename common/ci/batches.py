#!/usr/bin/env python3
"""Batch records and the build queue for the GitHub Actions runs (reports/actions/).

    batches.py pick <n>                 next <n> slugs of reports/actions/queue.txt not yet claimed, comma-separated
    batches.py claim <slugs> <run id>   add them to reports/actions/tasks.tsv as a new batch (status running); prints the batch
    batches.py summarize <slugs>        JSON results of these tasks from this checkout (build/<slug>/, tasks/<slug>/)
    batches.py record <json> --run <id> [--batch N --utc T]
                                        write those results into tasks.tsv, batch-<N>.md and README.md
    batches.py verdict <slugs>          JSON final-verdict inputs of accepted tasks: fairness (build/<slug>/FAIRNESS.md)
                                        and the audit of every failing run (~/.tb-graders/cwe/jobs/.../postmortem-*/)
    batches.py record-verdict <json>    write them into tasks.tsv, verdicts/<slug>.md, batch-<N>.md and README.md

A slug in tasks.tsv is never picked again (whatever its outcome), so no task is built twice. To build one again,
dispatch the build workflow with its slug.

Outcome (per task, from the trial records; the official verdict is still audit_results.py + audits + fairness):
    accepted     gate sound, both models graded >= 3 runs, no run reached 1.0
    rejected     gate sound, a model solved it (a run at 1.0)
    incomplete   gate sound, fewer graded runs than that and no solve
    unsound / gate error / listing fail   the gate's marker
    build failed no gate marker (builder or runner died)

Final verdict of an accepted task (pipelines/sibling/GUIDE.md steps 8-9; this is what is shared):
    FINAL BREAKER  fairness READY and every failing run audited trustworthy (the model's own failure)
    NEEDS FIX      fairness NOT_READY or an audit found a test / instruction / harness fault (GUIDE step 10)
    PENDING        an audit or the fairness review is missing or errored
"""
import argparse
import json
import subprocess
import sys
import time
import tomllib
from collections import defaultdict
from pathlib import Path

ROOT = next(p for p in Path(__file__).resolve().parents if (p / ".cwe-bench-root").is_file())
REP = ROOT / "reports" / "actions"
TASKS = REP / "tasks.tsv"
QUEUE = REP / "queue.txt"
COLS = ["slug", "batch", "run", "utc", "status", "gate", "deepseek", "mimo", "cwe", "language", "repo", "description",
        "final", "fairness", "audits"]
JOBS = Path.home() / ".tb-graders" / "cwe" / "jobs"
MODELS = ("deepseek", "mimo")
MARKERS = {".sound": "sound", ".unsound": "unsound", ".gate_error": "gate error", ".listing_fail": "listing fail"}


def now():
    return time.strftime("%Y-%m-%dT%H:%MZ", time.gmtime())


def read_rows():
    if not TASKS.is_file():
        return []
    lines = TASKS.read_text().splitlines()[1:]
    return [dict(zip(COLS, l.split("\t") + [""] * len(COLS))) for l in lines if l.strip()]


def write_rows(rows):
    REP.mkdir(parents=True, exist_ok=True)
    clean = lambda v: str(v).replace("\t", " ").replace("\n", " ")
    TASKS.write_text("\t".join(COLS) + "\n" + "".join("\t".join(clean(r.get(c, "")) for c in COLS) + "\n" for r in rows))


def pick(n):
    taken = {r["slug"] for r in read_rows()}
    out = []
    for line in QUEUE.read_text().splitlines() if QUEUE.is_file() else []:
        s = line.split("#")[0].strip()
        b = ROOT / "build" / s
        if s and s not in taken and s not in out and (b / "BUILD-PROMPT.md").is_file() and not (b / "pipeline.log").exists():
            out.append(s)
        if len(out) == n:
            break
    print(",".join(out))


def claim(slugs, run):
    rows = read_rows()
    batch = max([int(r["batch"]) for r in rows if r["batch"].isdigit()] + [0]) + 1
    rows += [{"slug": s, "batch": batch, "run": run, "utc": now(), "status": "running"} for s in slugs]
    write_rows(rows)
    print(batch)


def result(slug):
    b = ROOT / "build" / slug
    gate = next((v for k, v in MARKERS.items() if (b / k).exists()), "")
    rewards = {}
    for m in MODELS:
        f = b / f"trial_detail_{m}.json"
        runs = json.loads(f.read_text()).get("runs", []) if f.is_file() else []
        rewards[m] = [r["reward"] for r in runs if r.get("reward") is not None]
    if gate != "sound":
        status = gate or "build failed"
    elif any(1.0 in rewards[m] for m in MODELS):
        status = "rejected"
    elif all(len(rewards[m]) >= 3 for m in MODELS):
        status = "accepted"
    else:
        status = "incomplete"
    meta, task = {}, {}
    t = ROOT / "tasks" / slug / "task.toml"
    if t.is_file():
        d = tomllib.loads(t.read_text())
        meta, task = d.get("metadata", {}), d.get("task", {})
    return {"slug": slug, "gate": gate or "-", "status": status,
            **{m: " ".join(f"{x:g}" for x in rewards[m]) or "-" for m in MODELS},
            "cwe": meta.get("cwe_id", ""), "language": meta.get("language", ""), "repo": meta.get("repo", ""),
            "advisory": meta.get("advisory", ""), "description": task.get("description", "")}


def record(results, run, batch, utc, gh_repo):
    rows = read_rows()
    for res in results:
        row = next((r for r in rows if r["slug"] == res["slug"] and r["run"] == str(run)), None)
        if row is None:
            row = {"slug": res["slug"], "batch": batch or "?", "run": run, "utc": utc or now()}
            rows.append(row)
        row.update({k: v for k, v in res.items() if k in COLS})
        batch = batch or row["batch"]
    write_rows(rows)
    write_batch(int(batch), [r for r in rows if r["batch"] == str(batch)], results, gh_repo)
    write_readme(rows, gh_repo)


def audit_of(job):
    """Newest recorded audit (POSTMORTEM.json) of a trial job, or None."""
    pms = sorted((JOBS / job).glob("*/postmortem-*/POSTMORTEM.json"))
    return json.loads(pms[-1].read_text()) if pms else None


def verdict(slug):
    b = ROOT / "build" / slug
    fv = subprocess.run([sys.executable, "-I", str(ROOT / "common/fairness/fairness_verdict.py"), slug],
                        capture_output=True, text=True).stdout.strip() or "ERROR: no output"
    audits = []
    for m in MODELS:
        f = b / f"trial_detail_{m}.json"
        for r in json.loads(f.read_text()).get("runs", []) if f.is_file() else []:
            if r.get("reward") is None or r["reward"] == 1.0:
                continue                      # ungraded runs never count; solves are not audited
            a = audit_of(r["job"]) or {}
            audits.append({"model": m, "job": r["job"], "reward": r["reward"], "trustworthy": a.get("trustworthy"),
                           "attribution": a.get("attribution", "not audited"), "confidence": a.get("confidence", ""),
                           "summary": a.get("summary", "")})
    bad = [a for a in audits if a["trustworthy"] is False or a["attribution"] not in ("model-failed", "not audited")]
    missing = [a for a in audits if a["trustworthy"] is None]
    if fv.startswith("NOT_READY") or bad:
        final = "NEEDS FIX"
    elif fv.startswith("READY") and audits and not missing:
        final = "FINAL BREAKER"
    else:
        final = "PENDING"
    fair = b / "FAIRNESS.md"
    return {"slug": slug, "final": final, "fairness": fv, "audits": audits,
            "fairness_md": fair.read_text() if fair.is_file() else ""}


def record_verdict(items, gh_repo):
    rows = read_rows()
    (REP / "verdicts").mkdir(parents=True, exist_ok=True)
    batches = set()
    for v in items:
        row = [r for r in rows if r["slug"] == v["slug"]][-1]
        ok = sum(a["trustworthy"] is True and a["attribution"] == "model-failed" for a in v["audits"])
        row.update(final=v["final"], fairness=v["fairness"].split(" (")[0], audits=f"{ok}/{len(v['audits'])} trustworthy")
        batches.add(row["batch"])
        out = [f"# `{v['slug']}`: {v['final']}", "", f"- {row['description']}",
               f"- {row['cwe']}, {row['language']}, {row['repo']}", f"- Batch {row['batch']}, {links(row['run'], gh_repo)}",
               f"- Trials: DeepSeek {row['deepseek']} / MiMo {row['mimo']} (no run at 1.0)", "",
               f"## Fairness review: {v['fairness']}", "",
               f"Full review: [{v['slug']}-FAIRNESS.md]({v['slug']}-FAIRNESS.md)" if v["fairness_md"] else "No review written.", "",
               f"## Audits of the failing runs ({row['audits']})", "", "| Model | Reward | Trustworthy | Attribution | Auditor's summary |",
               "|---|---|---|---|---|"]
        out += [f"| {a['model']} | {a['reward']:g} | {a['trustworthy']} | {a['attribution']} ({a['confidence']}) | "
                f"{a['summary'].replace('|', '/').replace(chr(10), ' ')} |" for a in v["audits"]]
        (REP / "verdicts" / f"{v['slug']}.md").write_text("\n".join(out) + "\n")
        if v["fairness_md"]:
            (REP / "verdicts" / f"{v['slug']}-FAIRNESS.md").write_text(v["fairness_md"])
    write_rows(rows)
    for n in batches:
        write_batch(int(n), [r for r in rows if r["batch"] == n], [], gh_repo)
    write_readme(rows, gh_repo)


def links(run, gh_repo):
    return (f"[run {run}](https://github.com/{gh_repo}/actions/runs/{run}) · "
            f"[results branch](https://github.com/{gh_repo}/tree/runs/{run})")


def write_batch(n, rows, results, gh_repo):
    by_slug = {r["slug"]: r for r in results}
    runs = sorted({r["run"] for r in rows})
    out = [f"# Batch {n}", "", f"Started {min(r['utc'] for r in rows)}. " + "; ".join(links(r, gh_repo) for r in runs), "",
           "| Task | Gate | DeepSeek rewards | MiMo rewards | Outcome |", "|---|---|---|---|---|"]
    out += [f"| `{r['slug']}` | {r['gate'] or '-'} | {r['deepseek'] or '-'} | {r['mimo'] or '-'} | **{r['status']}** |" for r in rows]
    acc = [r for r in rows if r["status"] == "accepted"]
    if acc:
        out += ["", "## Accepted tasks", ""]
        for r in acc:
            a = by_slug.get(r["slug"], {})
            out += [f"### `{r['slug']}`", "", f"- {r['description']}", f"- {r['cwe']}, {r['language']}, {r['repo']}"
                    + (f" ({a['advisory']})" if a.get("advisory") else ""),
                    f"- DeepSeek {r['deepseek']} / MiMo {r['mimo']}",
                    f"- Final verdict: **{r['final'] or 'PENDING'}**" + (f" ([details](verdicts/{r['slug']}.md))" if r["final"] else ""), ""]
    (REP / f"batch-{n:02d}.md").write_text("\n".join(out).rstrip() + "\n")


def write_readme(rows, gh_repo):
    latest = {}
    for r in rows:
        latest[r["slug"]] = r          # last attempt of a task decides its outcome
    order = ["accepted", "rejected", "incomplete", "unsound", "gate error", "listing fail", "build failed", "running"]
    total = defaultdict(int)
    for r in latest.values():
        total[r["status"]] += 1
    batches = defaultdict(list)
    for r in rows:
        batches[int(r["batch"])].append(r)
    out = ["# GitHub Actions batches", "",
           "Builds and trials run on GitHub-hosted runners (`.github/workflows/build.yml`), 7 tasks per batch. With "
           "`chain` on, each batch starts the next one from `queue.txt` when it ends; a task listed in `tasks.tsv` is "
           "never picked again.", "",
           "**Accepted** = gate sound and both models failed all 3 runs (no run at 1.0). Each accepted task then gets "
           "the final verdict steps: an audit of every failing run (Claude Opus, `common/audit/postmortem.py`) and the "
           "fairness review (DeepSeek, `pipelines/sibling/9-fairness`). **FINAL BREAKER** = fairness READY and every "
           "failing run audited trustworthy: these are the tasks to share. **NEEDS FIX** = a fault was found (fairfix, "
           "GUIDE step 10). **PENDING** = a step has not finished.", "",
           f"## Totals ({len(latest)} tasks)", "", "| " + " | ".join(o for o in order if total[o]) + " |",
           "|" + "---|" * len([o for o in order if total[o]]), "| " + " | ".join(str(total[o]) for o in order if total[o]) + " |", "",
           "## Batches", "", "| Batch | Started | Tasks | Accepted | Rejected | Unsound / gate | Build failed | Other | Runs |",
           "|---|---|---|---|---|---|---|---|---|"]
    for n in sorted(batches):
        b = batches[n]
        c = lambda *s: sum(r["status"] in s for r in b)
        out.append(f"| [{n}](batch-{n:02d}.md) | {min(r['utc'] for r in b)} | {len(b)} | {c('accepted')} | {c('rejected')} | "
                   f"{c('unsound', 'gate error', 'listing fail')} | {c('build failed')} | {c('incomplete', 'running')} | "
                   + ", ".join(f"[{x}](https://github.com/{gh_repo}/actions/runs/{x})" for x in sorted({r['run'] for r in b})) + " |")
    acc = [r for r in latest.values() if r["status"] == "accepted"]
    fin = defaultdict(int)
    for r in acc:
        fin[r["final"] or "PENDING"] += 1
    out += ["", f"## Accepted tasks ({len(acc)}: " + ", ".join(f"{v} {k}" for k, v in sorted(fin.items())) + ")", "",
            "| Task | Final verdict | Batch | CWE | Language | Repo | DeepSeek | MiMo | Fairness | Audits | What it is |",
            "|---|---|---|---|---|---|---|---|---|---|---|"]
    out += [f"| `{r['slug']}` | " + (f"[**{r['final']}**](verdicts/{r['slug']}.md)" if r["final"] else "PENDING")
            + f" | {r['batch']} | {r['cwe']} | {r['language']} | {r['repo']} | {r['deepseek']} | {r['mimo']} | "
            f"{r['fairness'] or '-'} | {r['audits'] or '-'} | {r['description']} |" for r in acc]
    out += ["", "Files: `tasks.tsv` (one row per task attempt), `batch-NN.md` (per batch), `queue.txt` (what to build next, "
            "in order; add slugs that have `build/<slug>/BUILD-PROMPT.md`)."]
    (REP / "README.md").write_text("\n".join(out) + "\n")


def main():
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest="cmd", required=True)
    a = sp.add_parser("pick"); a.add_argument("n", type=int)
    a = sp.add_parser("claim"); a.add_argument("slugs"); a.add_argument("run")
    a = sp.add_parser("summarize"); a.add_argument("slugs")
    a = sp.add_parser("verdict"); a.add_argument("slugs")
    a = sp.add_parser("record-verdict"); a.add_argument("json"); a.add_argument("--repo", default="sherazrazadev/swe-benching")
    a = sp.add_parser("record"); a.add_argument("json"); a.add_argument("--run", required=True)
    a.add_argument("--batch"); a.add_argument("--utc"); a.add_argument("--repo", default="sherazrazadev/swe-benching")
    x = ap.parse_args()
    split = lambda s: [v for v in s.replace(" ", ",").split(",") if v]
    if x.cmd == "pick":
        pick(x.n)
    elif x.cmd == "claim":
        claim(split(x.slugs), x.run)
    elif x.cmd == "verdict":
        print(json.dumps([verdict(s) for s in split(x.slugs)], indent=1))
    elif x.cmd == "record-verdict":
        record_verdict(json.loads(Path(x.json).read_text()), x.repo)
    elif x.cmd == "summarize":
        print(json.dumps([result(s) for s in split(x.slugs)], indent=1))
    else:
        record(json.loads(Path(x.json).read_text()), x.run, x.batch, x.utc, x.repo)


if __name__ == "__main__":
    sys.exit(main())
