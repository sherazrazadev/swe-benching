#!/usr/bin/env python3
"""Merge the per-class JUnit XML written by the console launcher into one testsuites document."""
import glob
import os
import sys
import xml.etree.ElementTree as ET


def main():
    out, raw = sys.argv[1], sys.argv[2]
    root = ET.Element("testsuites")

    for path in sorted(glob.glob(os.path.join(raw, "*.xml"))):
        try:
            tree = ET.parse(path).getroot()
        except (ET.ParseError, OSError):
            continue
        if tree.tag == "testsuite":
            root.append(tree)
        elif tree.tag == "testsuites":
            for child in list(tree):
                root.append(child)

    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    ET.ElementTree(root).write(out, encoding="utf-8", xml_declaration=True)


if __name__ == "__main__":
    main()
