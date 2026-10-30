#!/usr/bin/env python3
"""List the workspace files that differ from the pristine checkout baked into the verifier image.

Output: one workspace-relative path per line, for changed or newly added Java sources and for
changed files under a module's src/main/resources. Only those files are recompiled at grade time.
"""
import hashlib
import os

ROOT = "/workspace"
MANIFEST = "/opt/pristine.sha256"
SKIP_DIRS = {"target", ".git", ".htests", "node_modules", ".cache"}


def digest(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    pristine = {}
    with open(MANIFEST, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line:
                continue
            h, _, path = line.partition("  ")
            pristine[path] = h

    changed = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, ROOT)
            if rel.startswith(".htests/"):
                continue
            if name.endswith(".java") or "/src/main/resources/" in "/" + rel:
                try:
                    if pristine.get(rel) != digest(full):
                        changed.append(rel)
                except OSError:
                    pass

    for rel in sorted(changed):
        print(rel)


if __name__ == "__main__":
    main()
