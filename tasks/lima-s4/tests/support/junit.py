"""Minimal JUnit XML writer for the hidden suites (score.py reads these)."""
import xml.sax.saxutils as _sx


def _esc(text):
    return _sx.escape(str(text), {'"': "&quot;"})


def write_junit(path, suite, cases):
    """cases: iterable of (name, status, message); status in pass/fail/error."""
    cases = list(cases)
    failures = sum(1 for _, s, _ in cases if s == "fail")
    errors = sum(1 for _, s, _ in cases if s == "error")
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<testsuite name="%s" tests="%d" failures="%d" errors="%d" skipped="0">'
             % (_esc(suite), len(cases), failures, errors)]
    for name, status, message in cases:
        lines.append('  <testcase classname="%s" name="%s">' % (_esc(suite), _esc(name)))
        if status == "fail":
            head = (str(message).splitlines() or ["failed"])[0]
            lines.append('    <failure message="%s">%s</failure>' % (_esc(head), _esc(message)))
        elif status == "error":
            head = (str(message).splitlines() or ["error"])[0]
            lines.append('    <error message="%s">%s</error>' % (_esc(head), _esc(message)))
        lines.append('  </testcase>')
    lines.append('</testsuite>')
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
