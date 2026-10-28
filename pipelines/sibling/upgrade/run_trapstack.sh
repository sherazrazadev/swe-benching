#!/bin/bash
# Round 2 on a near-miss: stack 2-3 real traps of the OTHER model's kind onto a task one model already fails
# (common/builder/BRIEF-trap-stack.md, as the VM did for grav/jetty), then a full re-gate.
# Usage: common/launch/drive.sh deepseek bash pipelines/sibling/upgrade/run_trapstack.sh SLUG
# Reads build/SLUG/ROUND1-MISSES.md if present (which hidden tests each round-1 run failed).
# Exit 0 = traps added and gated sound; 1 = agent did not finish (restored); 3 = no change (restored);
# 4 = changed but the gate did not pass (see trapstack-gate.log).
set -uo pipefail
. "$(d=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); while [ ! -f "$d/.cwe-bench-root" ] && [ "$d" != / ]; do d=$(dirname "$d"); done; echo "$d")/common/paths.sh"
SLUG=${1:?usage: pipelines/sibling/upgrade/run_trapstack.sh SLUG}
cd "$CWE_ROOT" || exit 1
B=build/$SLUG; GL="$B/trapstack-gate.log"
[ -n "${MODEL:-}" ] || { echo "error: MODEL not set; launch via common/launch/drive.sh" | tee "$B/trapstack_status.txt"; exit 1; }
echo "running" > "$B/trapstack_status.txt"
mkdir -p "$HOME/.tb-graders/cwe/work/$SLUG"
bash "$CWE_SNAPSHOT" "$SLUG"
fp() { find "$@" -type f 2>/dev/null | sort | xargs cat 2>/dev/null | sha256sum | cut -d' ' -f1; }
PRE_ALL=$(fp tasks/$SLUG $B/checks $B/manifest.json)
CWE_SNAP_MANIFEST=$(mktemp); cp "$B/manifest.json" "$CWE_SNAP_MANIFEST"
P="You are doing ROUND 2 on the already-built CWE-bench task $SLUG (project root $CWE_ROOT).
Read and follow common/builder/BRIEF-trap-stack.md (and common/builder/BUILDER.md, which it requires) exactly.
The base is this existing task: tasks/$SLUG/ (instruction.md, tests/, solution/, environment/) and
build/$SLUG/ (manifest.json, notes.md, checks/). Read them all first; keep everything that already works.
$( [ -f "$B/ROUND1-MISSES.md" ] && echo "Round-1 trial evidence (which hidden tests each run failed) is in build/$SLUG/ROUND1-MISSES.md:
the traps a model already misses consistently are the ones to keep; add 2-3 NEW traps of the kinds the brief
lists for the model that solved it, as real in-repo code or real pre-existing gaps.")
Edit only tasks/$SLUG/ and build/$SLUG/. Do not rename the task. Update the instruction only where a new trap
needs the general property to cover it (never name or describe a trap). Extend solution/fix.patch, the hidden
tests (one security test per new trap form + a coupled functional test), checks/ (one security_fail per new
trap) and manifest.json; then run the gate stages as the brief says. Record everything in build/$SLUG/notes.md
under a 'Round 2' heading."
date -u +%FT%TZ > "$B/trapstack_start.txt"
timeout "${TRAPSTACK_TIMEOUT:-10800}" "$HOME/.local/bin/claude" -p "$P" --model "$MODEL" \
  --permission-mode bypassPermissions --add-dir "$CWE_ROOT" --add-dir "$HOME/.tb-graders/cwe/work" \
  --output-format json > "$B/trapstack-run.json" 2> "$B/trapstack-run.err"
rc=$?
date -u +%FT%TZ > "$B/trapstack_end.txt"
st=$(python3 "$CWE_AGENT_STATUS" "$B/trapstack-run.json" "$rc" --details "$B/trapstack_status.json")
if [ "$st" != ok ]; then
  echo "$st" > "$B/trapstack_status.txt"; bash "$CWE_RESTORE" "$SLUG" "trapstack: $st"
  echo "$SLUG trapstack: NOT done ($st); task restored"; exit 1
fi
if [ "$(fp tasks/$SLUG $B/checks $B/manifest.json)" = "$PRE_ALL" ]; then
  echo "unchanged" > "$B/trapstack_status.txt"; bash "$CWE_RESTORE" "$SLUG" "trapstack: agent changed nothing"
  echo "$SLUG trapstack: agent changed nothing; restored"; exit 3
fi
# the brief tells the builder not to write the blind patch; keep the manifest's existing blind entry (the gate's
# static stage requires one), which builders tend to drop when they rewrite patch_checks (izpack, contrast)
python3 - "$B/manifest.json" "$CWE_SNAP_MANIFEST" <<'PY'
import json, sys
cur_p, old_p = sys.argv[1], sys.argv[2]
try:
    cur, old = json.load(open(cur_p)), json.load(open(old_p))
except Exception as e:
    print("blind entry check skipped:", e); sys.exit()
keep = [c for c in old.get("patch_checks", []) if c.get("kind") == "blind"]
have = {json.dumps(c, sort_keys=True) for c in cur.get("patch_checks", []) if c.get("kind") == "blind"}
add = [c for c in keep if json.dumps(c, sort_keys=True) not in have]
if add and not have:
    cur.setdefault("patch_checks", []).extend(add); json.dump(cur, open(cur_p, "w"), indent=1)
    print(f"restored {len(add)} blind patch_checks entr{'y' if len(add) == 1 else 'ies'} in the manifest")
# the round-1 blind fix was written for the old task and cannot close the new traps: drop the file, so the gate
# treats the blind check like a fresh build's (declared, file not written yet: skipped)
import os
for c in cur.get("patch_checks", []):
    if c.get("kind") == "blind":
        f = os.path.join(os.path.dirname(cur_p), "checks", str(c.get("patch")))
        if os.path.isfile(f):
            os.remove(f); print("removed the round-1 blind patch", f)
PY
rm -f "$B/.sound" "$B/.unsound" "$B/.gate_error"
if bash "$CWE_GATE_ONE" "$SLUG" >> "$GL" 2>&1; then
  echo "traps added and gated sound" > "$B/trapstack_status.txt"; code=0
else
  echo "traps added; gate: $(tail -1 "$GL")" > "$B/trapstack_status.txt"; code=4
fi
echo "$SLUG trapstack: $(cat "$B/trapstack_status.txt")"
exit $code
