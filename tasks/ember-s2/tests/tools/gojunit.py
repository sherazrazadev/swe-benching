#!/usr/bin/env python3
"""Convert a `go test -json` stream into one JUnit XML file.

Usage: gojunit.py <out.xml> < go-test-json

Every top-level test becomes a <testcase>. A package that failed without
reporting any test (a build failure, a panic before tests ran, a missing
dependency) becomes a synthetic failing testcase, so a broken build can never
look like "no tests, nothing failed". Non-JSON lines (build diagnostics on
stderr merged into the stream) are attached to the synthetic failure.
"""
import json
import sys
import xml.etree.ElementTree as ET


def xml_clean(text: str) -> str:
    """Return text with every character XML 1.0 forbids replaced by U+FFFD.

    Failure output can contain the raw terminal control bytes the tests are
    about; they are not legal in an XML document and would make the whole
    results file unparseable.
    """
    out = []
    for ch in text:
        o = ord(ch)
        if ch in "\t\n\r" or 0x20 <= o <= 0xD7FF or 0xE000 <= o <= 0xFFFD or o >= 0x10000:
            out.append(ch)
        else:
            out.append("\uFFFD")
    return "".join(out)


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: gojunit.py <out.xml>", file=sys.stderr)
        return 2
    out_path = sys.argv[1]

    cases = {}          # (package, test) -> {"status": str|None, "out": [str]}
    pkg_output = {}     # package -> [str]
    pkg_failed = set()
    pkg_had_test = set()
    loose = []          # non-JSON lines

    for raw in sys.stdin:
        line = raw.rstrip("\n")
        if not line.startswith("{"):
            if line.strip():
                loose.append(line)
            continue
        try:
            ev = json.loads(line)
        except json.JSONDecodeError:
            loose.append(line)
            continue
        if not isinstance(ev, dict):
            continue
        action = ev.get("Action", "")
        pkg = ev.get("Package") or ev.get("ImportPath") or ""
        test = ev.get("Test", "")
        if ev.get("Output") is not None:
            if test:
                cases.setdefault((pkg, test), {"status": None, "out": []})["out"].append(ev["Output"])
            else:
                pkg_output.setdefault(pkg, []).append(ev["Output"])
        if test:
            pkg_had_test.add(pkg)
            c = cases.setdefault((pkg, test), {"status": None, "out": []})
            if action in ("pass", "fail", "skip"):
                c["status"] = action
        elif action in ("fail", "build-fail"):
            pkg_failed.add(pkg)

    if loose:
        pkg_output.setdefault("<build>", []).extend(loose)

    suite = ET.Element("testsuite", name="gotest")
    tests = failures = errors = skipped = 0
    for (pkg, test), c in sorted(cases.items()):
        tc = ET.SubElement(suite, "testcase", classname=pkg or "go", name=test)
        tests += 1
        status = c["status"]
        if status == "skip":
            ET.SubElement(tc, "skipped")
            skipped += 1
        elif status == "fail":
            body = xml_clean("".join(c["out"])[-8000:])
            f = ET.SubElement(tc, "failure", message=xml_clean((body.strip().splitlines() or ["failed"])[-1][:300]))
            f.text = body
            failures += 1
        elif status is None:
            # The test started but the stream ended (killed / crashed build).
            ET.SubElement(tc, "error", message="test did not finish")
            errors += 1

    for pkg in sorted(pkg_failed - pkg_had_test):
        body = xml_clean("".join(pkg_output.get(pkg, []))[-8000:]) or "package failed before running any test"
        tc = ET.SubElement(suite, "testcase", classname=pkg or "go", name="build")
        f = ET.SubElement(tc, "failure", message=xml_clean(("build failed: " + (body.strip().splitlines() or ["?"])[0])[:300]))
        f.text = body
        tests += 1
        failures += 1

    # A stream with no test at all is a broken run, never a silent pass.
    if tests == 0:
        body = xml_clean("".join(pkg_output.get("<build>", []))[-8000:]) or "go test produced no tests"
        tc = ET.SubElement(suite, "testcase", classname="go", name="no-tests")
        f = ET.SubElement(tc, "failure", message="no tests ran")
        f.text = body
        tests = failures = 1

    suite.set("tests", str(tests))
    suite.set("failures", str(failures))
    suite.set("errors", str(errors))
    suite.set("skipped", str(skipped))
    ET.ElementTree(suite).write(out_path, encoding="utf-8", xml_declaration=True)
    print(f"gojunit: {tests} tests, {failures} failures, {errors} errors", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
