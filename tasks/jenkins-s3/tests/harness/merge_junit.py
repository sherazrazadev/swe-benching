#!/usr/bin/env python3
"""Merge the native runner's per-class JUnit XML files into one suite.

If a group produced no XML at all (compile failure, start-up failure), write a single failing
case so the group is scored as failed rather than silently disappearing.
"""
import glob
import os
import sys
import xml.etree.ElementTree as ET


def main():
    out = sys.argv[1]
    dirs = sys.argv[2:]
    cases = []
    for directory in dirs:
        if not os.path.isdir(directory):
            continue
        for path in sorted(glob.glob(os.path.join(directory, "*.xml"))):
            try:
                root = ET.parse(path).getroot()
            except Exception:
                continue
            for case in root.iter("testcase"):
                cases.append(case)
    suite = ET.Element("testsuite", name="group", tests=str(len(cases)))
    if cases:
        for case in cases:
            suite.append(case)
    else:
        suite.set("failures", "1")
        case = ET.SubElement(suite, "testcase", classname="bench.Group", name="no-results")
        failure = ET.SubElement(case, "failure", message="the group produced no test results")
        failure.text = "no JUnit XML was produced by the project's test runner"
    ET.ElementTree(suite).write(out, encoding="UTF-8", xml_declaration=True)


if __name__ == "__main__":
    main()
