#!/usr/bin/env python3
"""Merge several JUnit XML files into one, keeping every testcase.

The hidden suites and each package's own test run write their own report. score.py reads every
<testcase> under the group directory, so the merger only has to produce a single well-formed
document that carries all of them.
"""
import copy
import sys
import xml.etree.ElementTree as ET


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: merge_junit.py <out.xml> <in.xml>...", file=sys.stderr)
        return 2
    out_path, inputs = sys.argv[1], sys.argv[2:]

    root = ET.Element("testsuites", {"name": "merged"})
    total = 0
    failures = 0
    for path in inputs:
        try:
            tree = ET.parse(path)
        except (OSError, ET.ParseError):
            continue
        for case in tree.getroot().iter("testcase"):
            root.append(copy.deepcopy(case))
            total += 1
            if case.find("failure") is not None or case.find("error") is not None:
                failures += 1
    root.set("tests", str(total))
    root.set("failures", str(failures))
    ET.ElementTree(root).write(out_path, encoding="utf-8", xml_declaration=True)
    print(f"merged {total} testcases ({failures} failing) into {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
