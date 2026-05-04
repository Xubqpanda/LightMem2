#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAW_EVAL_REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECT_ROOT="$(cd "${CLAW_EVAL_REPO_ROOT}/../../.." && pwd)"

ROOT_DIR="${PROJECT_ROOT}"
BENCH_PY="${CLAW_EVAL_REPO_ROOT}/scripts/benchmark.py"
TASKS_DIR="${CLAW_EVAL_REPO_ROOT}/dataset/tasks"
SOURCE_DIR="${CLAW_EVAL_REPO_ROOT}/vendor"
PLUGIN_ROOT="${CLAW_EVAL_REPO_ROOT}/plugins"
OPENCLAW_CONFIG_PATH_DEFAULT="/home/xubuqiang/.openclaw/openclaw.json"

if [[ -f "${CLAW_EVAL_REPO_ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${CLAW_EVAL_REPO_ROOT}/.env"
  set +a
elif [[ -f "${CLAW_EVAL_REPO_ROOT}/../pinchbench/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${CLAW_EVAL_REPO_ROOT}/../pinchbench/.env"
  set +a
fi

export HOME="${HOME:-/home/xubuqiang}"
export OPENCLAW_CONFIG_PATH="${OPENCLAW_CONFIG_PATH:-${OPENCLAW_CONFIG_PATH_DEFAULT}}"
export TOKENPILOT_OPENCLAW_HOME="${TOKENPILOT_OPENCLAW_HOME:-/home/xubuqiang}"
export CLAW_EVAL_SOURCE_ROOT="${CLAW_EVAL_SOURCE_ROOT:-${SOURCE_DIR}}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-/tmp/openclaw-cache}"
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-/tmp/openclaw-config}"
export UV_CACHE_DIR="${UV_CACHE_DIR:-/tmp/uv-cache}"
export PYTHONUNBUFFERED="${PYTHONUNBUFFERED:-1}"
export CLAW_EVAL_AGENT_TIMEOUT_SECONDS="${CLAW_EVAL_AGENT_TIMEOUT_SECONDS:-0}"

# Requested plugin policy: reduction + stability only; eviction/estimator off.
export TOKENPILOT_ENABLE_REDUCTION="${TOKENPILOT_ENABLE_REDUCTION:-true}"
export TOKENPILOT_ENABLE_EVICTION="${TOKENPILOT_ENABLE_EVICTION:-false}"
export TOKENPILOT_TASK_STATE_ESTIMATOR_ENABLED="${TOKENPILOT_TASK_STATE_ESTIMATOR_ENABLED:-false}"
export TOKENPILOT_FORCE_GATEWAY_RESTART="${TOKENPILOT_FORCE_GATEWAY_RESTART:-false}"

SUITE="${CLAW_EVAL_SUITE:-general}"
MODEL="${CLAW_EVAL_MODEL:-tokenpilot/gpt-5.4-mini}"
JUDGE_MODEL="${CLAW_EVAL_JUDGE_MODEL:-${MODEL}}"
PARALLEL="${CLAW_EVAL_PARALLEL:-1}"
LOG_FILE="${CLAW_EVAL_LOG_FILE:-${ROOT_DIR}/claw_eval_isolated_general_plugin.log}"
PID_FILE="${CLAW_EVAL_PID_FILE:-${ROOT_DIR}/claw_eval_isolated_general_plugin.pid}"
EXTRA_ARGS="${CLAW_EVAL_EXTRA_ARGS:-}"
CPUSET="${CPUSET:-}"
NICE_LEVEL="${NICE_LEVEL:-}"

mkdir -p "$(dirname "${LOG_FILE}")" "$XDG_CACHE_HOME" "$XDG_CONFIG_HOME" "$UV_CACHE_DIR"

run_foreground() {
  cd "${ROOT_DIR}"
  exec python3 "${BENCH_PY}" \
    --tasks-dir "${TASKS_DIR}" \
    --suite "${SUITE}" \
    --phase full \
    --session-mode isolated \
    --parallel "${PARALLEL}" \
    --model "${MODEL}" \
    --judge "${JUDGE_MODEL}" \
    --output-dir "${CLAW_EVAL_REPO_ROOT}/save/isolated" \
    --plugin-root "${PLUGIN_ROOT}" \
    --openclaw-config-path "${OPENCLAW_CONFIG_PATH}" \
    --apply-plugin-plan \
    --execute-tasks \
    ${EXTRA_ARGS}
}

if [[ "${1:-}" == "--foreground" ]]; then
  run_foreground
  exit 0
fi

launcher=()
if [[ -n "${CPUSET}" ]]; then
  launcher+=(taskset -c "${CPUSET}")
fi
if [[ -n "${NICE_LEVEL}" ]]; then
  launcher+=(nice -n "${NICE_LEVEL}")
fi
launcher+=(bash "$0" --foreground)
nohup "${launcher[@]}" > "${LOG_FILE}" 2>&1 &
echo $! > "${PID_FILE}"
echo "started claw-eval isolated general plugin run"
echo "pid=$(cat "${PID_FILE}")"
echo "log=${LOG_FILE}"
echo "parallel=${PARALLEL}"
echo "reduction=${TOKENPILOT_ENABLE_REDUCTION} eviction=${TOKENPILOT_ENABLE_EVICTION} estimator=${TOKENPILOT_TASK_STATE_ESTIMATOR_ENABLED}"
echo "cpuset=${CPUSET:-all} nice=${NICE_LEVEL:-default}"
