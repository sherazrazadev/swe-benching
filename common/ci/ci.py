#!/usr/bin/env python3
"""GitHub Actions helpers for cwe-bench (used by .github/workflows/; also runnable locally).

    ci.py pack <build|trial> <slug> <out.tgz> [--model M --run N]
        Pack what this job produced: files under the repo changed since $CI_MARK_FILE (build/<slug>, tasks/<slug>,
        and shared ledgers), plus the Harbor job folders (gate-jobs for a build, jobs for a trial). API keys
        found in the files are replaced by "***".
    ci.py collect <dir> [--jobs]
        Unpack every *.tgz under <dir> (build-* before trial-*) into this checkout. Files of a task are
        copied; logs/ledgers (.log .tsv .jsonl .md) gain only their new lines; trial_detail*.json files from
        parallel run jobs are merged. --jobs also copies the Harbor job folders into ~/.tb-graders/cwe/.
    ci.py sound <dir>
        JSON list of slugs whose build artifact left build/<slug>/.sound.
    ci.py next <dir> --models deepseek,mimo --runs 3 [--first 1]
        After the first run: JSON matrix of the remaining runs (first+1 .. first+runs-1) for every task that no
        model solved in it.

Verdicts are NOT computed here: they stay with common/trial/trial.py and common/audit/audit_results.py.
"""
import argparse
import json
import os
import shutil
import sys
import tarfile
import tempfile
import time
from pathlib import Path

ROOT = next(p for p in Path(__file__).resolve().parents if (p / ".cwe-bench-root").is_file())
TB = Path.home() / ".tb-graders" / "cwe"
LOGS = {".log", ".tsv", ".jsonl"}   # append-only files: merge new lines, never overwrite
SKIP_DIRS = {".git", ".github", "common", "__pycache__"}
MAX_FILE = 50 * 1024 * 1024
# dependency/build folders inside Harbor job folders: hundreds of thousands of files, not needed for audits
JOB_SKIP = {".git", "node_modules", ".venv", "venv", "site-packages", ".gradle", ".m2", ".cache", ".npm",
            ".pnpm-store", "target", "__pycache__"}


def newer_files(base, mark, skip=frozenset({"__pycache__"})):
    for dp, dns, fns in os.walk(base):
        dns[:] = [d for d in dns if d not in (SKIP_DIRS if Path(dp) == ROOT else skip)]
        for fn in fns:
            p = Path(dp) / fn
            try:
                st = p.lstat()
            except OSError:
                continue
            if st.st_mtime >= mark and st.st_size <= MAX_FILE and not p.is_symlink():
                yield p


def scrub(path, keys):
    try:
        data = path.read_bytes()
    except OSError:
        return
    new = data
    for k in keys:
        new = new.replace(k, b"***")
    if new != data:
        path.write_bytes(new)


def pack(kind, slug, out, model=None, run=None):
    mark = Path(os.environ.get("CI_MARK_FILE", "/tmp/ci_mark")).stat().st_mtime   # touched when the job's work starts
    keys = [os.environ[k].encode() for k in ("DEEPSEEK_API_KEY", "MIMO_API_KEY") if len(os.environ.get(k, "")) > 8]
    stage, jstage = Path(tempfile.mkdtemp()), Path(tempfile.mkdtemp())
    n = 0
    for p in newer_files(ROOT, mark):
        dst = stage / "repo" / p.relative_to(ROOT)
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, dst)
        n += 1
    jobs_root, prefix = (TB / "gate-jobs", f"{slug}-") if kind == "build" else (TB / "jobs", f"{slug}-{model}-r{run}-")
    m = 0
    if jobs_root.is_dir():
        for d in jobs_root.iterdir():
            if d.name.startswith(prefix) and d.is_dir():
                for p in newer_files(d, 0, JOB_SKIP):
                    dst = jstage / "tb" / jobs_root.name / p.relative_to(jobs_root)
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(p, dst)
                    m += 1
    # repo files -> <out> (small: what trials and collect need); Harbor job folders -> jobs-<out name> (audits only)
    meta = json.dumps({"kind": kind, "slug": slug, "model": model, "run": run,
                       "utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "repo_files": n, "job_files": m})
    jout = Path(out).with_name("jobs-" + Path(out).name)
    for st, o in ((stage, Path(out)), (jstage, jout)):
        for p in st.rglob("*"):
            if p.is_file():
                scrub(p, keys)
        if st is jstage and not m:
            break
        (st / "meta.json").write_text(meta)
        with tarfile.open(o, "w:gz") as t:
            t.add(st, arcname=".")
    shutil.rmtree(stage); shutil.rmtree(jstage)
    print(f"packed {kind} {slug}: {n} repo files -> {out}; {m} job files -> {jout if m else '-'}")


def merge_lines(src, dst):
    old = dst.read_text(errors="replace").splitlines()
    seen = set(old)
    add = [l for l in src.read_text(errors="replace").splitlines() if l not in seen]
    if add:
        with open(dst, "a") as f:
            if old and not dst.read_text(errors="replace").endswith("\n"):
                f.write("\n")
            f.write("\n".join(add) + "\n")


def merge_detail(src, dst):
    a, b = json.loads(dst.read_text()), json.loads(src.read_text())
    jobs = {r.get("job") for r in a.get("runs", [])}
    a["runs"] = a.get("runs", []) + [r for r in b.get("runs", []) if r.get("job") not in jobs]
    a["runs"].sort(key=lambda r: (r.get("model") or "", r.get("run") or 0))
    a["verdict"] = "merged by common/ci/ci.py from parallel run jobs; read audit_results.py for verdicts"
    dst.write_text(json.dumps(a, indent=1))


def unpack(tgz, jobs=False):
    d = Path(tempfile.mkdtemp())
    with tarfile.open(tgz) as t:
        # older packs carry the job folders inside: leave them packed unless asked for
        t.extractall(d, members=(m for m in t if jobs or not m.name.startswith(("./tb/", "tb/"))), filter="data")
    return d


def artifacts(where):
    return sorted(Path(where).rglob("*.tgz"), key=lambda p: (not p.name.startswith("build-"), p.name))


def is_jobs(tgz):
    return tgz.name.startswith("jobs-")


def collect(where, jobs):
    for tgz in artifacts(where):
        if is_jobs(tgz) and not jobs:
            continue
        d = unpack(tgz, jobs)
        meta = json.loads((d / "meta.json").read_text())
        task_dirs = (f"build/{meta['slug']}/", f"tasks/{meta['slug']}/")
        c = 0
        for p in (d / "repo").rglob("*") if (d / "repo").is_dir() else []:
            if not p.is_file():
                continue
            rel = p.relative_to(d / "repo").as_posix()
            dst = ROOT / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            if not dst.exists():
                shutil.copy2(p, dst)
            elif p.read_bytes() == dst.read_bytes():
                continue
            elif p.name.startswith("trial_detail") and p.suffix == ".json":
                merge_detail(p, dst)
            elif rel.startswith(task_dirs):
                (merge_lines if p.suffix in LOGS else shutil.copy2)(p, dst)
            elif p.suffix in LOGS | {".md", ".txt"}:
                merge_lines(p, dst)
            else:
                print(f"  SKIPPED shared file that differs and is not a log/ledger: {rel} (from {tgz.name})")
                continue
            c += 1
        if jobs and (d / "tb").is_dir():
            shutil.copytree(d / "tb", TB, dirs_exist_ok=True)
        print(f"collected {tgz.name}: {c} repo files{' + job folders' if jobs else ''}")
        shutil.rmtree(d)


def sound(where):
    out = []
    for tgz in artifacts(where):
        with tarfile.open(tgz) as t:
            names = t.getnames()
        slug = tgz.name[len("build-"):-len(".tgz")]
        if tgz.name.startswith("build-") and any(n.endswith(f"repo/build/{slug}/.sound") for n in names):
            out.append(slug)
    print(json.dumps(out))


def nxt(where, models, runs, first=1):
    solved, seen = set(), set()
    for tgz in artifacts(where):
        if not tgz.name.startswith("trial-"):
            continue
        d = unpack(tgz)
        meta = json.loads((d / "meta.json").read_text())
        seen.add(meta["slug"])
        for f in (d / "repo" / "build" / meta["slug"]).glob("trial_detail*.json"):
            if any(r.get("reward") == 1.0 for r in json.loads(f.read_text()).get("runs", [])):
                solved.add(meta["slug"])
        shutil.rmtree(d)
    print(json.dumps([{"slug": s, "model": m, "run": r}
                      for s in sorted(seen - solved) for m in models for r in range(first + 1, first + runs)]))


def main():
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest="cmd", required=True)
    a = sp.add_parser("pack"); a.add_argument("kind", choices=["build", "trial"]); a.add_argument("slug")
    a.add_argument("out"); a.add_argument("--model"); a.add_argument("--run", type=int)
    a = sp.add_parser("collect"); a.add_argument("dir"); a.add_argument("--jobs", action="store_true")
    a = sp.add_parser("sound"); a.add_argument("dir")
    a = sp.add_parser("next"); a.add_argument("dir"); a.add_argument("--models", default="deepseek,mimo")
    a.add_argument("--runs", type=int, default=3); a.add_argument("--first", type=int, default=1)
    x = ap.parse_args()
    if x.cmd == "pack":
        pack(x.kind, x.slug, x.out, x.model, x.run)
    elif x.cmd == "collect":
        collect(x.dir, x.jobs)
    elif x.cmd == "sound":
        sound(x.dir)
    else:
        nxt(x.dir, [m.strip() for m in x.models.split(",") if m.strip()], x.runs, x.first)


if __name__ == "__main__":
    sys.exit(main())
