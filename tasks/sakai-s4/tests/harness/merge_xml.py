#!/usr/bin/env python3
"""Merge Maven surefire reports from several modules into one JUnit XML file.

A module that produced no report at all becomes a failing testcase, so a submission whose test
sources or product sources do not compile cannot silently skip that module's checks.
"""
import glob
import os
import sys
import xml.etree.ElementTree as ET


def main():
    out, group = sys.argv[1], sys.argv[2]
    report_dirs = sys.argv[3:]

    cases = []
    missing = []
    for report_dir in report_dirs:
        module = report_dir.split("/target/")[0].replace("/", ".")
        files = sorted(glob.glob(os.path.join(report_dir, "TEST-*.xml")))
        if not files:
            missing.append(module)
        for path in files:
            try:
                root = ET.parse(path).getroot()
            except Exception:
                missing.append(module + ".unparseable")
                continue
            for case in root.iter("testcase"):
                cases.append(case)

    failures = sum(1 for c in cases if c.find("failure") is not None)
    errors = sum(1 for c in cases if c.find("error") is not None) + len(missing)
    suite = ET.Element("testsuite", name=group,
                       tests=str(len(cases) + len(missing)),
                       failures=str(failures), errors=str(errors))
    for case in cases:
        suite.append(case)
    for module in missing:
        case = ET.SubElement(suite, "testcase", classname=group, name="report." + module)
        ET.SubElement(case, "error", message="no test results were produced for " + module)
    ET.ElementTree(suite).write(out, encoding="utf-8", xml_declaration=True)


if __name__ == "__main__":
    main()
