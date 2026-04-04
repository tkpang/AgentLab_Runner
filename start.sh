#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$ROOT_DIR/.run"
mkdir -p "$RUN_DIR"

RUNNER_PID_FILE="$RUN_DIR/runner.pid"
GUI_PID_FILE="$RUN_DIR/gui.pid"
RUNNER_LOG_FILE="$RUN_DIR/runner.log"
GUI_LOG_FILE="$RUN_DIR/gui.log"

RUNNER_SERVER="${RUNNER_SERVER:-http://127.0.0.1:3200}"
RUNNER_TOKEN="${RUNNER_TOKEN:-}"

is_running() {
  local pid_file="$1"
  if [[ ! -f "$pid_file" ]]; then
    return 1
  fi
  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

start_gui() {
  if is_running "$GUI_PID_FILE"; then
    echo "[runner] Web GUI already running (pid $(cat "$GUI_PID_FILE"))."
    return
  fi
  if pgrep -f "node .*runner/gui/server.cjs|node server.cjs" >/dev/null 2>&1; then
    echo "[runner] Found existing Web GUI process, cleaning stale instances..."
    pkill -f "node .*runner/gui/server.cjs|node server.cjs" >/dev/null 2>&1 || true
    sleep 0.5
  fi
  export PATH="$ROOT_DIR/.runtime/node/current:$PATH"
  if ! command -v node >/dev/null 2>&1; then
    echo "[runner] node not found, please run setup first."
    return
  fi
  echo "[runner] Starting Web GUI..."
  (
    cd "$ROOT_DIR"
    nohup node "$ROOT_DIR/gui/server.cjs" >>"$GUI_LOG_FILE" 2>&1 &
    echo $! >"$GUI_PID_FILE"
  )
  echo "[runner] Web GUI started (pid $(cat "$GUI_PID_FILE"))."
}

start_runner_daemon() {
  if [[ -z "$RUNNER_TOKEN" ]]; then
    echo "[runner] RUNNER_TOKEN is empty, skip daemon startup."
    echo "[runner] Export RUNNER_TOKEN then run ./start.sh again."
    return
  fi
  if is_running "$RUNNER_PID_FILE"; then
    echo "[runner] Runner daemon already running (pid $(cat "$RUNNER_PID_FILE"))."
    return
  fi
  echo "[runner] Starting daemon..."
  (
    cd "$ROOT_DIR"
    RUNNER_SERVER="$RUNNER_SERVER" RUNNER_TOKEN="$RUNNER_TOKEN" nohup bash scripts/start-runner.sh >>"$RUNNER_LOG_FILE" 2>&1 &
    echo $! >"$RUNNER_PID_FILE"
  )
  echo "[runner] Runner daemon started (pid $(cat "$RUNNER_PID_FILE"))."
}

start_gui
start_runner_daemon

echo
echo "[runner] Logs:"
echo "  GUI:    $GUI_LOG_FILE"
echo "  Daemon: $RUNNER_LOG_FILE"
