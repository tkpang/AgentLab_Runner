#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$ROOT_DIR/.run"
RUNNER_PID_FILE="$RUN_DIR/runner.pid"
GUI_PID_FILE="$RUN_DIR/gui.pid"

stop_by_pid_file() {
  local name="$1"
  local pid_file="$2"
  if [[ ! -f "$pid_file" ]]; then
    echo "[runner] $name not running (no pid file)."
    return
  fi
  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [[ -z "$pid" ]]; then
    rm -f "$pid_file"
    echo "[runner] $name pid file empty, cleaned."
    return
  fi
  if kill -0 "$pid" 2>/dev/null; then
    echo "[runner] Stopping $name (pid $pid)..."
    kill "$pid" 2>/dev/null || true
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
    echo "[runner] $name stopped."
  else
    echo "[runner] $name already exited (pid $pid)."
  fi
  rm -f "$pid_file"
}

stop_by_pid_file "Runner daemon" "$RUNNER_PID_FILE"
stop_by_pid_file "Web GUI" "$GUI_PID_FILE"

# Fallback cleanup for stale GUI processes not tracked by pid file.
if pgrep -f "node .*runner/gui/server.cjs|node server.cjs" >/dev/null 2>&1; then
  echo "[runner] Cleaning stale Web GUI node processes..."
  pkill -f "node .*runner/gui/server.cjs|node server.cjs" >/dev/null 2>&1 || true
fi
