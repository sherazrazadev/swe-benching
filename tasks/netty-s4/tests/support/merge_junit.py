#!/usr/bin/env python3
"""Merge surefire's per-class TEST-*.xml reports into one JUnit XML file.

Usage: merge_junit.py <reports-dir> <out-file>

The verifier's group runner writes one merged document so the root orchestrator can copy a
single results file into /logs/verifier/<group>/.
"""
import glob
import os
import sys
import xml.etree.ElementTree as ET


def main():
    reports_dir, out_file = sys.argv[1], sys.argv[2]
    root = ET.Element("testsuites")
    for path in sorted(glob.glob(os.path.join(reports_dir, "TEST-*.xml"))):
        try:
            tree = ET.parse(path).getroot()
        except (ET.ParseError, OSError):
            continue
        if tree.tag == "testsuite":
            root.append(tree)
        elif tree.tag == "testsuites":
            for child in list(tree):
                root.append(child)
    ET.ElementTree(root).write(out_file, encoding="utf-8", xml_declaration=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
