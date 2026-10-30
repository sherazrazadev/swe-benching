#!/usr/bin/env python3
"""Write a single failing JUnit testcase, used when a group cannot produce results."""
import os
import sys
import xml.etree.ElementTree as ET


def main():
    out, message = sys.argv[1], sys.argv[2][:500]
    root = ET.Element("testsuites")
    suite = ET.SubElement(root, "testsuite", name="runner", tests="1", failures="1", errors="0")
    case = ET.SubElement(suite, "testcase", classname="runner", name="runner")
    failure = ET.SubElement(case, "failure", message=message)
    failure.text = message
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    ET.ElementTree(root).write(out, encoding="utf-8", xml_declaration=True)


if __name__ == "__main__":
    main()
