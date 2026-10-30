#!/usr/bin/env python3
"""Convert `go test -json` events on stdin into JUnit XML on stdout.

One <testcase> per Go test (including subtests). A package that fails to build emits
only package-level output and a package-level fail, so it gets a synthetic `build`
testcase carrying the compiler output. A test that started but never reported a
terminal event (the run was cut) is reported as a failure, never as a pass.
"""
import json
import re
import sys
from xml.sax.saxutils import escape, quoteattr

ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")
XML_BAD = re.compile("[^\u0009\u000a\u000d -퟿-�]")


def clean(text):
    """Drop terminal escape sequences and characters XML 1.0 cannot carry."""
    return XML_BAD.sub("", ANSI.sub("", text))



def main():
    records = {}      # (package, test) -> {status, elapsed, out}
    pkg_status = {}
    pkg_out = {}

    for raw in sys.stdin:
        raw = raw.strip()
        if not raw:
            continue
        try:
            ev = json.loads(raw)
        except ValueError:
            continue
        pkg = ev.get("Package") or ev.get("ImportPath") or ""
        test = ev.get("Test")
        action = ev.get("Action")
        # `go test -json` reports setup/compile failures as build-output/build-fail.
        action = {"build-output": "output", "build-fail": "fail", "build-pass": "pass"}.get(action, action)
        if test:
            rec = records.setdefault((pkg, test), {"status": "run", "elapsed": 0.0, "out": []})
            if action == "output":
                rec["out"].append(ev.get("Output") or "")
            elif action in ("pass", "fail", "skip"):
                rec["status"] = action
                try:
                    rec["elapsed"] = float(ev.get("Elapsed") or 0.0)
                except (TypeError, ValueError):
                    rec["elapsed"] = 0.0
        else:
            if action == "output":
                pkg_out.setdefault(pkg, []).append(ev.get("Output") or "")
            elif action in ("pass", "fail", "skip"):
                pkg_status[pkg] = action

    lines = ['<?xml version="1.0" encoding="UTF-8"?>', "<testsuites>"]
    packages = sorted(set(p for p, _ in records) | set(pkg_status))
    for pkg in packages:
        cases = sorted((t, r) for (p, t), r in records.items() if p == pkg)
        lines.append(f'<testsuite name={quoteattr(pkg)} tests="{len(cases)}">')
        if not cases and pkg_status.get(pkg) == "fail":
            out = "".join(pkg_out.get(pkg, []))[-4000:]
            lines.append(
                f'<testcase classname={quoteattr(pkg)} name="build">'
                f'<failure message="build failed">{escape(clean(out))}</failure></testcase>'
            )
        for name, rec in cases:
            when = f' time="{rec["elapsed"]:.3f}"'
            if rec["status"] == "fail":
                out = "".join(rec["out"])[-4000:]
                lines.append(
                    f'<testcase classname={quoteattr(pkg)} name={quoteattr(name)}{when}>'
                    f'<failure message="failed">{escape(clean(out))}</failure></testcase>'
                )
            elif rec["status"] == "skip":
                lines.append(
                    f'<testcase classname={quoteattr(pkg)} name={quoteattr(name)}{when}>'
                    f"<skipped/></testcase>"
                )
            elif rec["status"] == "run":
                lines.append(
                    f'<testcase classname={quoteattr(pkg)} name={quoteattr(name)} time="0.000">'
                    f'<failure message="test did not finish"/></testcase>'
                )
            else:
                lines.append(f'<testcase classname={quoteattr(pkg)} name={quoteattr(name)}{when}/>')
        lines.append("</testsuite>")
    lines.append("</testsuites>")
    sys.stdout.write("\n".join(lines) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
