#!/usr/bin/env python3
"""Turn JUnit XML results into the task reward, and record BOTH scoring views.

Reads every *.xml under /logs/verifier/security and /logs/verifier/functional.
Writes:
  results.json  — per-test outcomes + both rewards
  reward.json   — {"reward": <threshold>}     (PRIMARY: what trials/breaker detection read)
  reward.txt    — <threshold>
  metrics.json  — {scoring_mode, status, reward (threshold), passed_total (template ratio),
                   passed, failed, errors, skipped, total}

PRIMARY reward (threshold, unchanged): 1.0 only when every security and every functional test
passes; 0 if any functional test fails (a fix that breaks the feature earns nothing); otherwise
the share of security tests passing, capped below 1. A group with no results counts as failed.
passed_total (template view): passed / total across both groups (reported alongside, not primary).
"""
import glob
import json
import os
import sys
import xml.etree.ElementTree as ET

ROOT = os.environ.get("VERIFIER_DIR", "/logs/verifier")


def collect(group):
    """Return {name: status} with status in {pass, fail, error, skipped}."""
    out = {}
    for path in sorted(glob.glob(os.path.join(ROOT, group, "*.xml"))):
        try:
            tree = ET.parse(path)
        except ET.ParseError:
            out[f"{os.path.basename(path)}::unparseable"] = "error"
            continue
        for case in tree.iter("testcase"):
            name = f"{case.get('classname', '')}::{case.get('name', '')}"
            if case.find("error") is not None:
                out[name] = "error"
            elif case.find("failure") is not None:
                out[name] = "fail"
            elif case.find("skipped") is not None:
                out[name] = "skipped"  # proves nothing, not a pass
            else:
                out[name] = "pass"
    return out


def main():
    sec, fun = collect("security"), collect("functional")

    def n(d, *st):
        return sum(v in st for v in d.values())

    sec_ok, fun_ok = n(sec, "pass"), n(fun, "pass")
    all_sec = bool(sec) and sec_ok == len(sec)
    all_fun = bool(fun) and fun_ok == len(fun)

    # PRIMARY: threshold reward (unchanged semantics)
    if all_sec and all_fun:
        reward = 1.0
    elif not all_fun:
        reward = 0.0
    else:
        reward = round(min(sec_ok / len(sec), 0.99), 4) if sec else 0.0

    # SECONDARY: template passed/total view + raw counts
    both = {**{f"security/{k}": v for k, v in sec.items()},
            **{f"functional/{k}": v for k, v in fun.items()}}
    total = len(both)
    passed = n(both, "pass")
    failed = n(both, "fail")
    errors = n(both, "error")
    skipped = n(both, "skipped")
    passed_total = round(passed / total, 10) if total else 0.0

    with open(os.path.join(ROOT, "results.json"), "w") as f:
        json.dump({"security": sec, "functional": fun,
                   "reward": reward, "passed_total": passed_total}, f, indent=1)
    with open(os.path.join(ROOT, "reward.json"), "w") as f:
        json.dump({"reward": reward}, f)
    with open(os.path.join(ROOT, "reward.txt"), "w") as f:
        f.write(f"{reward}\n")
    with open(os.path.join(ROOT, "metrics.json"), "w") as f:
        json.dump({"scoring_mode": "threshold+passed_total", "status": "scored",
                   "reward": reward, "passed_total": passed_total,
                   "passed": passed, "failed": failed, "errors": errors,
                   "skipped": skipped, "total": total}, f)
    print(f"security {sec_ok}/{len(sec)}  functional {fun_ok}/{len(fun)}  "
          f"reward {reward}  passed_total {passed}/{total}")
    return 0 if reward == 1.0 else 1


if __name__ == "__main__":
    sys.exit(main())
