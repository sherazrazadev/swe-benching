#!/bin/bash
# common/launch/drive.sh <deepseek|mimo> <command...>
#
# Runs the given command with Claude Code pointed at DeepSeek V4.1 Flash or
# MiMo-V2.6-Pro instead of the (capped) Claude account -- the same base-URL
# override that common/trial/run_trial.sh uses for trials. This lets the EXISTING
# generation launchers (common/launch/run_build.sh / common/blindfix/run_blindfix.sh /
# pipelines/sibling/9-fairness/run_fairness.sh / pipelines/sibling/10-fairfix/run_fairfix.sh)
# be "model driven" without editing them or any per-candidate prompt: only the model that answers changes.
#
# The driver model is used ONLY to generate and review tasks. Trials still
# evaluate every task on BOTH targets via run_trial.sh -- that is unchanged and
# is what defines a breaker.
#
#   MODEL is exported so run_*.sh's `--model "${MODEL:-...}"` uses the driver.
#
# Usage examples:
#   common/launch/drive.sh deepseek bash common/launch/run_build.sh my-task-ds
#   common/launch/drive.sh mimo     bash pipelines/sibling/9-fairness/run_fairness.sh my-task-mm
set -uo pipefail
. "$(d=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); while [ ! -f "$d/.cwe-bench-root" ] && [ "$d" != / ]; do d=$(dirname "$d"); done; echo "$d")/common/paths.sh"
DRIVER=${1:?usage: common/launch/drive.sh <deepseek|mimo> <command...>}; shift || true

# First env file found wins (same search order as common/trial/run_trial.sh).
for env_file in "${CWE_MODELS_ENV:-}" "$HOME/.tb-graders/cwe/models.env" "$CWE_ROOT/.env" "$HOME/.env"; do
  if [ -n "$env_file" ] && [ -f "$env_file" ]; then set -a; . "$env_file"; set +a; break; fi
done

case "$DRIVER" in
  deepseek)
    export ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
    export ANTHROPIC_API_KEY="${DEEPSEEK_API_KEY:?DEEPSEEK_API_KEY not set in models.env}"
    export MODEL='deepseek-flash[1m]'
    # DeepSeek-max counts reasoning toward the budget and will "think to exhaustion"
    # and return empty on hard tasks without a large cap (see run_trial.sh).
    export CLAUDE_CODE_AUTO_COMPACT_WINDOW=786432
    export CLAUDE_CODE_MAX_OUTPUT_TOKENS=131072
    export CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1
    export MAX_THINKING_TOKENS=96000
    ;;
  mimo)
    export ANTHROPIC_BASE_URL=https://api.xiaomimimo.com/anthropic
    export ANTHROPIC_API_KEY="${MIMO_API_KEY:?MIMO_API_KEY not set in models.env}"
    export MODEL='mimo-v2.6-pro'
    export CLAUDE_CODE_MAX_OUTPUT_TOKENS=131072   # as DeepSeek; Claude Code's default for an unknown model is 32000
    ;;
  *) echo "unknown driver: $DRIVER (expected deepseek or mimo)" >&2; exit 2 ;;
esac

# Long reasoning calls need a big per-request API timeout or they get cut mid-think.
export API_TIMEOUT_MS=1200000
# These would route back to the capped Claude account; make sure the key wins.
unset ANTHROPIC_AUTH_TOKEN CLAUDE_CODE_OAUTH_TOKEN ANTHROPIC_MODEL

exec "$@"
