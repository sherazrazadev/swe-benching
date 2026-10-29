#!/usr/bin/env python3
"""Merge the JUnit XML files a Maven Surefire run produced into one report.

Writes a single failing test case when the runner produced no report at all, so a
submission that does not build is scored as a failing group rather than as a verifier
fault.
"""
import glob
import os
import sys
import xml.etree.ElementTree as ET


def failure(out, reason):
    root = ET.Element("testsuite", name="harness", tests="1", failures="1",
                      errors="0", skipped="0")
    case = ET.SubElement(root, "testcase", classname="harness.Submission",
                         name="suiteExecutes")
    ET.SubElement(case, "failure", message=reason).text = reason
    ET.ElementTree(root).write(out, encoding="UTF-8", xml_declaration=True)


def main():
    root, out = sys.argv[1], sys.argv[2]
    files = sorted(glob.glob(os.path.join(
        root, "**", "target", "surefire-reports", "TEST-*.xml"), recursive=True))
    if not files:
        failure(out, "the test runner produced no results")
        return 0
    merged = ET.Element("testsuites")
    used = 0
    for path in files:
        try:
            root = ET.parse(path).getroot()
        except (ET.ParseError, OSError):
            continue
        if root.tag == "testsuite":
            merged.append(root)
            used += 1
        elif root.tag == "testsuites":
            for suite in root.findall("testsuite"):
                merged.append(suite)
            used += 1
    if not used:
        failure(out, "the test runner produced no readable results")
        return 0
    ET.ElementTree(merged).write(out, encoding="UTF-8", xml_declaration=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
