#!/usr/bin/env python3
"""Normalise source mtimes in the restored workspace against the image's pristine hash list.

Cargo decides whether a local package needs rebuilding from source mtimes. The verifier image
pre-built the pinned tree at /workspace; after Harbor restores the submission there, every file
is either identical to that tree (touch it to the build-time timestamp so the cached artifacts
stay fresh) or changed/new (touch it to now so its package rebuilds). Content is compared by
sha256, so a change is never missed because of a timestamp.
"""
import hashlib
import os
import sys
import time

OLD = 1577836800  # 2020-01-01T00:00:00Z, the timestamp the image normalised /workspace to


def main() -> int:
    manifest, root = sys.argv[1], sys.argv[2]
    pristine = {}
    with open(manifest, "r", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            line = line.rstrip("\n")
            if not line:
                continue
            digest, _, path = line.partition("  ")
            if not path:
                continue
            pristine[os.path.normpath(path)] = digest

    now = time.time()
    for base, dirs, files in os.walk(root):
        if base == root:
            dirs[:] = [d for d in dirs if d not in (".git", "target")]
        for name in files:
            path = os.path.join(base, name)
            rel = os.path.normpath(os.path.relpath(path, root))
            try:
                with open(path, "rb") as fh:
                    digest = hashlib.sha256(fh.read()).hexdigest()
            except OSError:
                continue
            stamp = OLD if pristine.get(rel) == digest else now
            try:
                os.utime(path, (stamp, stamp))
            except OSError:
                pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
