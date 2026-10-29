#!/usr/bin/env python3
"""Merge the Gradle per-class JUnit XML reports into one file for score.py.

Usage: merge_junit.py <out.xml> <results-dir>
Removes <out.xml> and exits 1 when the directory holds no report, so the caller can
write an explicit error case instead of silently shrinking the scored set.
"""
import glob
import os
import sys
import xml.etree.ElementTree as ET


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: merge_junit.py <out.xml> <results-dir>", file=sys.stderr)
        return 2
    out, directory = sys.argv[1], sys.argv[2]
    suites = []
    for path in sorted(glob.glob(os.path.join(directory, "*.xml"))):
        try:
            suites.append(ET.parse(path).getroot())
        except (ET.ParseError, OSError):
            continue
    if not suites:
        try:
            os.remove(out)
        except OSError:
            pass
        return 1
    root = ET.Element("testsuites")
    for suite in suites:
        root.append(suite)
    ET.ElementTree(root).write(out, encoding="utf-8", xml_declaration=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
