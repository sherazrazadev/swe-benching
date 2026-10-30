#!/usr/bin/env python3
"""Convert libtest output captured from `cargo test` into a JUnit XML file.

Usage: junit.py <cargo-log> <output-xml> <suite-name>

A missing or unparseable log produces a single failing case, so a compile
error can never be mistaken for a pass.
"""
import re
import sys
from xml.sax.saxutils import escape

TEST_LINE = re.compile(r"^test ([\w:]+) \.\.\. (ok|FAILED|ignored)")


def main() -> int:
    if len(sys.argv) != 4:
        print("usage: junit.py <log> <xml> <suite>", file=sys.stderr)
        return 2
    log_path, xml_path, suite = sys.argv[1:4]
    try:
        with open(log_path, "r", errors="replace") as handle:
            text = handle.read()
    except OSError as exc:
        text = f"could not read cargo log: {exc}"

    cases = []
    for line in text.splitlines():
        match = TEST_LINE.match(line.strip())
        if match:
            cases.append((match.group(1), match.group(2)))

    failures = 0
    body = []
    if not cases:
        failures = 1
        detail = text[-4000:] if text else "no test output"
        body.append(
            f'<testcase classname="{escape(suite)}" name="build_or_run">'
            f'<failure message="no test results produced">{escape(detail)}</failure>'
            "</testcase>"
        )
    else:
        for name, outcome in cases:
            if outcome == "ok":
                body.append(f'<testcase classname="{escape(suite)}" name="{escape(name)}"/>')
            else:
                failures += 1
                body.append(
                    f'<testcase classname="{escape(suite)}" name="{escape(name)}">'
                    f'<failure message="{outcome}">{escape(name)} {outcome}</failure>'
                    "</testcase>"
                )

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<testsuite name="{escape(suite)}" tests="{len(body)}" failures="{failures}">\n'
        + "\n".join(body)
        + "\n</testsuite>\n"
    )
    with open(xml_path, "w") as handle:
        handle.write(xml)
    return 0


if __name__ == "__main__":
    sys.exit(main())
