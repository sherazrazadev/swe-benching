#!/usr/bin/env bash
# Start the built application on a fresh database, run one hidden Playwright group against
# it, and always shut it down. Everything here runs as the unprivileged agent user.
set -uo pipefail

group="${1:?usage: run-group.sh <security|functional> <junit-out>}"
out="${2:?usage: run-group.sh <security|functional> <junit-out>}"
origin="http://localhost:1411"

tmp="$(mktemp -d "${TMPDIR:-/tmp}/pocket-id-verify-XXXXXX")"
srv=""

cleanup() {
  if [ -n "$srv" ]; then
    kill "$srv" 2>/dev/null
    wait "$srv" 2>/dev/null
  fi
  rm -rf "$tmp"
}
trap cleanup EXIT INT TERM

export APP_ENV=test
# Must match the key the project's e2e seed encrypted its fixture key material with.
export ENCRYPTION_KEY='test-encryption-key'
export DB_CONNECTION_STRING="$tmp/pocket-id.db"
export UPLOAD_PATH="$tmp/uploads"
export FILE_BACKEND=filesystem
export APP_URL="$origin"
export PORT=1411
export DISABLE_RATE_LIMITING=true
export ANALYTICS_DISABLED=true
export VERSION_CHECK_DISABLED=true
export LOG_LEVEL=warn

/workspace/.build/pocket-id >"$tmp/server.log" 2>&1 &
srv=$!

ready=0
for _ in $(seq 1 160); do
  if curl -fsS -o /dev/null "$origin/" 2>/dev/null; then ready=1; break; fi
  if ! kill -0 "$srv" 2>/dev/null; then break; fi
  sleep 0.5
done
if [ "$ready" != 1 ]; then
  echo "verifier: the application did not become ready" >&2
  tail -80 "$tmp/server.log" >&2
  exit 1
fi

export APP_ORIGIN="$origin"
export PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright
export JUNIT_OUT="$out"
export GROUP="$group"

cd /workspace/tests/.htests || exit 1
/workspace/tests/node_modules/.bin/playwright test --config ./playwright.config.ts
