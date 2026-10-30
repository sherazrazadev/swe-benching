#!/usr/bin/env bash
# Run one hidden libtest target and convert its output to JUnit XML.
# Usage: run_group.sh <test-target> <suite-name> <junit-out>
set -u
target="$1"
suite="$2"
out="$3"
log="${out%.xml}.log"
cd /workspace || exit 1
cargo test --offline -p microsandbox --test "$target" -- --test-threads=1 > "$log" 2>&1
python3 /workspace/.htests/junit.py "$log" "$out" "$suite"
