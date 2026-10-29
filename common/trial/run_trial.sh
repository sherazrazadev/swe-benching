#!/usr/bin/env bash
. "$(d=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); while [ ! -f "$d/.cwe-bench-root" ] && [ "$d" != / ]; do d=$(dirname "$d"); done; echo "$d")/common/paths.sh"
. "$CWE_DOCKER_TUNING" 2>/dev/null || true
# Run a Harbor task with Claude Code driving DeepSeek V4.1 Flash or MiMo-V2.6-Pro.
#
#   run_trial.sh <deepseek|mimo> <task-dir> [attempts] [extra harbor args...]
#
# Keys (DEEPSEEK_API_KEY, MIMO_API_KEY) are read from an env file, see below.
# Harbor installs Claude Code into the task container itself, so no task image
# needs changing: the model is selected entirely by the settings below.
set -euo pipefail

model=${1:?usage: run_trial.sh <deepseek|mimo> <task-dir> [attempts] [harbor args...]}
task=${2:?task directory required}
attempts=${3:-1}
shift $(( $# < 3 ? $# : 3 ))

# First file found wins: $CWE_MODELS_ENV, ~/.tb-graders/cwe/models.env, then the
# repo's git-ignored .env.
for env_file in "${CWE_MODELS_ENV:-}" "$HOME/.tb-graders/cwe/models.env" "$CWE_ROOT/../.env"; do
  if [ -n "$env_file" ] && [ -f "$env_file" ]; then set -a; . "$env_file"; set +a; break; fi
done

# Per-run hold: build/<task>/hold_<model> stops any NEW run of that task/model from
# starting (checked on every run, so it also stops a trial.py loop that is already
# going, e.g. after the same runs were started in parallel by hand).
hold="$CWE_BUILD/$(basename "$task")/hold_$model"
if [ -f "$hold" ]; then echo "held: $hold exists; not starting a run" >&2; exit 3; fi
# A task whose tests/solution/environment/checks changed after its gate pass must be re-gated first
# (common/gate/fingerprint.py; rule in pipelines/*/GUIDE.md). Tasks gated before 2026-10-25: warning only.
python3 -I "$CWE_ROOT/common/gate/fingerprint.py" check "$(basename "$task")" >&2; fp=$?
if [ "$fp" = 1 ]; then echo "refused: stale gate; re-gate before any new run" >&2; exit 3; fi

extra=()
case "$model" in
  deepseek)
    # https://api-docs.deepseek.com/quick_start/agent_integrations/claude_code/
    base_url=https://api.deepseek.com/anthropic
    key=${DEEPSEEK_API_KEY:?DEEPSEEK_API_KEY is not set (see models.env.example)}
    model_id='deepseek-flash[1m]'   # served by DeepSeek-V4.1-Flash, 1M context
    extra+=(--allow-agent-host=api.deepseek.com)   # new tasks are no-network; allow the model host at run time (B4)
    effort=${EFFORT-max}
    extra+=(--ae CLAUDE_CODE_AUTO_COMPACT_WINDOW=786432)
    # DeepSeek-max counts reasoning toward the token budget and will think
    # to exhaustion and return empty on hard tasks without a large cap (Task13).
    extra+=(--ae CLAUDE_CODE_MAX_OUTPUT_TOKENS=131072)
    extra+=(--ae CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1)
    extra+=(--ak max_thinking_tokens=96000)
    ;;
  mimo)
    base_url=https://api.xiaomimimo.com/anthropic
    key=${MIMO_API_KEY:?MIMO_API_KEY is not set (see models.env.example)}
    model_id=mimo-v2.6-pro
    extra+=(--allow-agent-host=api.xiaomimimo.com)   # new tasks are no-network; allow the model host at run time (B4)
    effort=${EFFORT-}
    # Claude Code does not know mimo-v2.6-pro ("unrecognized_model") and capped each reply at its 32000-token default;
    # same cap as DeepSeek since 2026-10-29 (the provider accepts it: .github/workflows/model-check.yml)
    extra+=(--ae CLAUDE_CODE_MAX_OUTPUT_TOKENS=131072)
    ;;
  *) echo "unknown model: $model (expected deepseek or mimo)" >&2; exit 2 ;;
esac
[ -n "$effort" ] && extra+=(--ak "reasoning_effort=$effort")

# DeepSeek-max / MiMo calls can run long; the default per-request API timeout
# (~300s) cuts them off mid-reasoning (empty result). Task13: set >= 900s.
extra+=(--ae API_TIMEOUT_MS=1200000)

# Harbor does not record the task's agent time limit in a trial; pass it as an env
# var so each trial's config.json carries the limit it ran under (read by
# common/audit/audit_results.py). Runs before 2026-10-15 have no such var: they ran at 3600 s.
limit=$(awk '/^\[/{s=$0} s=="[agent]" && /^timeout_sec/{print int($3)}' "$task/task.toml")
# Optional longer limit for a re-run after a timeout (user, 2026-10-16: a run that fails by hitting
# the 2 h limit is re-run with 3 h). CWE_AGENT_TIMEOUT_MULT=1.5 -> Harbor's agent timeout x1.5,
# and the recorded limit (CWE_AGENT_LIMIT_SEC, read by common/audit/audit_results.py) matches it.
mult_args=()
if [ -n "${CWE_AGENT_TIMEOUT_MULT:-}" ]; then
  limit=$(python3 -c "print(int($limit * $CWE_AGENT_TIMEOUT_MULT))")
  mult_args=(--agent-timeout-multiplier "$CWE_AGENT_TIMEOUT_MULT")
fi
[ -n "$limit" ] && extra+=(--ae "CWE_AGENT_LIMIT_SEC=$limit")

# Keep the container (stopped) after the run instead of deleting it, so the agent's
# final code can be saved and, if grading broke, re-graded. common/trial/trial.py saves the
# code, then removes containers of clean solves and lists the rest for review.
extra+=(--ek keep_containers=true)

# No web tools (2026-10-16). CWE-bench agents reach only the model API. Claude Code's WebSearch
# runs on the provider's side, inside the allowed API call, so the network allowlist cannot stop
# it: it returned live results in the "offline" filament r11 run. Remove the tools themselves.
extra+=(--ak "disallowed_tools=WebSearch,WebFetch")

# Passed through the process environment, not --ae, so the key stays out of
# the command line and the job's saved config.
export ANTHROPIC_BASE_URL=$base_url ANTHROPIC_API_KEY=$key
unset ANTHROPIC_AUTH_TOKEN CLAUDE_CODE_OAUTH_TOKEN ANTHROPIC_MODEL

exec harbor run -p "$task" -a claude-code -m "$model_id" -k "$attempts" ${mult_args[@]+"${mult_args[@]}"} \
  -o "${JOBS_DIR:-$HOME/.tb-graders/cwe/jobs}" \
  --job-name "$(basename "$task")-$model-$(date +%m%d-%H%M%S)" \
  ${extra[@]+"${extra[@]}"} "$@"
