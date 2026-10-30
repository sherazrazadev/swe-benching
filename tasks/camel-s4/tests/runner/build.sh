#!/bin/bash
# Build the submission: recompile every product source that differs from the pristine checkout
# against the dependency jars baked into this image. Runs as the unprivileged agent.
set -uo pipefail

cd /workspace || exit 1

BASE=/workspace/.htests
CLS="$BASE/patch-classes"
CHANGED=/tmp/changed.txt
JAVA_LIST=/tmp/changed-java.txt

rm -rf "$CLS"
mkdir -p "$CLS"

python3 -I /opt/detect-changes.py > "$CHANGED" || exit 1

grep '\.java$' "$CHANGED" > "$JAVA_LIST" || true
sed 's|^|/workspace/|' "$JAVA_LIST" > "$CHANGED.abs"

if [ -s "$JAVA_LIST" ]; then
    javac -nowarn -encoding UTF-8 -cp "$(cat /opt/camel-test-cp.txt)" -d "$CLS" @"$CHANGED.abs" || exit 2
fi

# Overlay any changed resource (service registrations, configuration) so it wins over the jar.
python3 -I - "$CHANGED" "$CLS" <<'PY' || exit 3
import os
import shutil
import sys

changed, cls = sys.argv[1], sys.argv[2]
for line in open(changed, encoding="utf-8", errors="replace"):
    rel = line.strip()
    if not rel or rel.endswith(".java") or "/src/main/resources/" not in "/" + rel:
        continue
    src = os.path.join("/workspace", rel)
    tail = rel.split("/src/main/resources/", 1)[1]
    dst = os.path.join(cls, tail)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copyfile(src, dst)
PY

exit 0
