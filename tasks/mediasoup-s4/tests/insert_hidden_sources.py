#!/usr/bin/env python3
"""Insert the hidden test sources into the project's meson test_sources list.

Usage: insert_hidden_sources.py <path-to-worker/meson.build> <dir-with-hidden-cpp>

The project lists its Catch2 sources explicitly in `test_sources = [...]`. The hidden
suites are copied next to the project sources at grading time and their paths are
appended to that list. If the anchor is gone the verifier fails loudly (build_failed)
rather than silently scoring an empty suite.
"""
import glob
import os
import sys


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: insert_hidden_sources.py <meson.build> <hidden-dir>", file=sys.stderr)
        return 2

    meson_path, hidden_dir = sys.argv[1], sys.argv[2]
    sources = sorted(glob.glob(os.path.join(hidden_dir, "*.cpp")))

    if not sources:
        print(f"no hidden test sources under {hidden_dir}", file=sys.stderr)
        return 2

    with open(meson_path, encoding="utf-8") as f:
        lines = f.readlines()

    worker_dir = os.path.dirname(os.path.abspath(meson_path))
    out = []
    inserted = False

    for line in lines:
        out.append(line)

        if not inserted and line.lstrip().startswith("test_sources") and "[" in line:
            for source in sources:
                rel = os.path.relpath(os.path.abspath(source), worker_dir)
                out.append(f"  '{rel}',\n")
            inserted = True

    if not inserted:
        print("could not find the test_sources list in meson.build", file=sys.stderr)
        return 1

    with open(meson_path, "w", encoding="utf-8") as f:
        f.writelines(out)

    print(f"inserted {len(sources)} hidden test sources")

    return 0


if __name__ == "__main__":
    sys.exit(main())
