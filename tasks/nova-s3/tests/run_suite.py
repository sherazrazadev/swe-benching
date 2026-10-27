#!/usr/bin/env python
"""Run one hidden group with unittest and write JUnit XML for score.py.

Usage: run_suite.py <security|functional> <output.xml>
"""
import os
import sys
import traceback
import unittest
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
WORKSPACE = os.getcwd()
sys.path.insert(0, WORKSPACE)
sys.path.insert(0, HERE)


class RecordingResult(unittest.TestResult):
    def __init__(self):
        unittest.TestResult.__init__(self)
        self.records = []

    def _add(self, test, status, detail=''):
        cls = test.__class__
        classname = '%s.%s' % (getattr(cls, '__module__', ''),
                               getattr(cls, '__name__', 'Test'))
        name = getattr(test, '_testMethodName', 'unknown')
        self.records.append((classname, name, status, detail or ''))

    def addSuccess(self, test):
        unittest.TestResult.addSuccess(self, test)
        self._add(test, 'pass')

    def addFailure(self, test, err):
        detail = self._exc_info_to_string(err, test)
        unittest.TestResult.addFailure(self, test, err)
        self._add(test, 'failure', detail)

    def addError(self, test, err):
        detail = self._exc_info_to_string(err, test)
        unittest.TestResult.addError(self, test, err)
        self._add(test, 'error', detail)

    def addSkip(self, test, reason):
        unittest.TestResult.addSkip(self, test, reason)
        self._add(test, 'skipped', reason)

    def addExpectedFailure(self, test, err):
        unittest.TestResult.addExpectedFailure(self, test, err)
        self._add(test, 'pass')

    def addUnexpectedSuccess(self, test):
        unittest.TestResult.addUnexpectedSuccess(self, test)
        self._add(test, 'failure', 'unexpected success')


def write_xml(records, out):
    suite = ET.Element('testsuite', name='nova-s3')
    suite.set('tests', str(len(records)))
    suite.set('failures', str(len([r for r in records if r[2] == 'failure'])))
    suite.set('errors', str(len([r for r in records if r[2] == 'error'])))
    suite.set('skipped', str(len([r for r in records if r[2] == 'skipped'])))
    for classname, name, status, detail in records:
        case = ET.SubElement(suite, 'testcase', classname=classname, name=name)
        if status in ('failure', 'error'):
            node = ET.SubElement(case, status, message=detail.splitlines()[0][:300]
                                 if detail.splitlines() else status)
            node.text = detail
        elif status == 'skipped':
            ET.SubElement(case, 'skipped', message=detail[:300])
    ET.ElementTree(suite).write(out)


def main():
    if len(sys.argv) != 3:
        sys.stderr.write('usage: run_suite.py <group> <output.xml>\n')
        return 2
    group, out = sys.argv[1], sys.argv[2]
    start = os.path.join(HERE, group)
    try:
        suite = unittest.TestLoader().discover(start, pattern='test_*.py',
                                               top_level_dir=HERE)
        result = RecordingResult()
        suite.run(result)
        records = result.records
    except Exception:
        records = [(group, 'discovery', 'error', traceback.format_exc())]
    try:
        write_xml(records, out)
    except Exception:
        sys.stderr.write(traceback.format_exc())
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
