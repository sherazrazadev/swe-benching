#!/usr/bin/env python3
"""Convert `go test -json` output into a JUnit XML file.

Usage: gojson2junit.py <events.json> <results.xml>

The verifier runs the project's native runner (`go test`) as the unprivileged
agent user; this script only reshapes its machine-readable output so score.py
can read pass/fail per test. A package that fails without producing any test
case (for example a compile error) becomes one synthetic failing test case, so
the group is never silently empty.
"""
import json
import sys
import xml.etree.ElementTree as ET


def main():
    src, dst = sys.argv[1], sys.argv[2]
    tests = {}          # (package, test) -> dict(status, output)
    package_out = {}    # package -> [lines]
    package_failed = set()

    try:
        handle = open(src, "r", errors="replace")
    except OSError:
        handle = []

    for line in handle:
        line = line.strip()
        if not line:
            continue
        try:
            event = json.loads(line)
        except ValueError:
            continue
        package = event.get("Package", "")
        test = event.get("Test", "")
        action = event.get("Action", "")
        output = event.get("Output", "")
        if not test:
            if output:
                package_out.setdefault(package, []).append(output)
            if action == "fail":
                package_failed.add(package)
            continue
        entry = tests.setdefault((package, test), {"status": "run", "output": []})
        if output:
            entry["output"].append(output)
        if action in ("pass", "fail", "skip"):
            entry["status"] = action

    suite = ET.Element("testsuite", name="hidden")
    total = failures = skipped = 0

    for (package, test), entry in sorted(tests.items()):
        case = ET.SubElement(suite, "testcase", classname=package, name=test)
        total += 1
        if entry["status"] == "fail":
            failures += 1
            failure = ET.SubElement(case, "failure", message="failed")
            failure.text = "".join(entry["output"])
        elif entry["status"] == "skip":
            skipped += 1
            ET.SubElement(case, "skipped")
        elif entry["status"] == "run":
            # No terminal event: treat as an error rather than a silent pass.
            failures += 1
            failure = ET.SubElement(case, "failure", message="no terminal result")
            failure.text = "".join(entry["output"])

    if package_failed and not any(pkg in package_failed for pkg, _ in tests):
        for package in sorted(package_failed):
            total += 1
            failures += 1
            case = ET.SubElement(suite, "testcase", classname=package, name="package_failed")
            failure = ET.SubElement(case, "failure", message="package failed without test cases")
            failure.text = "".join(package_out.get(package, []))

    suite.set("tests", str(total))
    suite.set("failures", str(failures))
    suite.set("errors", "0")
    suite.set("skipped", str(skipped))
    ET.ElementTree(suite).write(dst, encoding="utf-8", xml_declaration=True)


if __name__ == "__main__":
    main()
