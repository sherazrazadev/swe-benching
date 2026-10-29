#!/usr/bin/env python3
"""Write a one-test JUnit XML that records a verifier-side failure to build or run the suite."""
import sys
import xml.etree.ElementTree as ET


def main():
    out, message = sys.argv[1], sys.argv[2]
    suite = ET.Element("testsuite", {"name": "hidden", "tests": "1", "failures": "1",
                                     "errors": "0", "skipped": "0"})
    case = ET.SubElement(suite, "testcase", {"classname": "hidden", "name": "suite-unavailable"})
    ET.SubElement(case, "failure", {"message": message})
    ET.ElementTree(suite).write(out, encoding="utf-8", xml_declaration=True)


if __name__ == "__main__":
    main()
