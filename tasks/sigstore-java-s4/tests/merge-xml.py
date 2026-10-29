#!/usr/bin/env python3
"""Merge the JUnit XML files one group produced into a single <testsuites> document."""
import glob
import os
import sys
import xml.etree.ElementTree as ET


def main():
    reports, out, group = sys.argv[1], sys.argv[2], sys.argv[3]
    suites = []
    for path in sorted(glob.glob(os.path.join(reports, "*.xml"))):
        try:
            root = ET.parse(path).getroot()
        except ET.ParseError:
            continue
        if root.tag == "testsuite":
            suites.append(root)
        else:
            suites.extend(root.findall("testsuite"))
    merged = ET.Element("testsuites", {"name": group})
    for suite in suites:
        merged.append(suite)
    if not suites:
        case = ET.SubElement(
            ET.SubElement(merged, "testsuite", {"name": group, "tests": "1", "failures": "1"}),
            "testcase", {"classname": group, "name": "group-produced-no-results"})
        ET.SubElement(case, "failure", {"message": "no test results were produced"})
    ET.ElementTree(merged).write(out, encoding="utf-8", xml_declaration=True)


if __name__ == "__main__":
    main()
