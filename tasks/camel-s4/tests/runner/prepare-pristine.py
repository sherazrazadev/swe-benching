#!/usr/bin/env python3
"""Record the hash of every file in the pristine checkout, to detect the submission's changes."""
import hashlib
import os

ROOT = "/tmp/warm"
OUT = "/opt/pristine.sha256"


def main():
    lines = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in (".git", "target")]
        for name in filenames:
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, ROOT)
            h = hashlib.sha256()
            with open(full, "rb") as f:
                for chunk in iter(lambda: f.read(1 << 20), b""):
                    h.update(chunk)
            lines.append("%s  %s" % (h.hexdigest(), rel))

    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(sorted(lines)) + "\n")


if __name__ == "__main__":
    main()
