#!/bin/bash
# Run one hidden group with nextest and write its JUnit report to the path given as $2.
# Runs as the unprivileged `agent` user from /workspace with a clean environment.
# $1 group name, $2 JUnit output path, $3 test-name filter (substring).
set -u
group="$1"
out="$2"
filter="$3"
cd /workspace || exit 1
export CARGO_HOME=/usr/local/cargo
export RUSTUP_HOME=/usr/local/rustup
export CARGO_NET_OFFLINE=1
export CARGO_TERM_COLOR=never
export CARGO_TARGET_DIR=/opt/target
export CARGO_INCREMENTAL=0
export RUSTUP_TOOLCHAIN=1.88
junit=/workspace/target/nextest/ci/junit.xml
rm -f "$junit"
cargo nextest run --offline --bin codewhale-tui --profile ci \
    --config-file /workspace/.htests/nextest.toml "$filter" \
    > "/workspace/.htests/nextest-$group.log" 2>&1
if [ -s "$junit" ]; then
    cp -f "$junit" "$out"
else
    # No report means the group could not be built or run: count it as a failure rather
    # than silently shrinking the scored set.
    printf '%s\n' \
        '<?xml version="1.0" encoding="UTF-8"?>' \
        "<testsuite name=\"$group\" tests=\"1\" failures=\"1\">" \
        "<testcase classname=\"$group\" name=\"group-ran\"><failure message=\"the $group suite did not run\"/></testcase>" \
        '</testsuite>' > "$out"
fi
exit 0
