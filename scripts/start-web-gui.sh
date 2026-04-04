#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNNER_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
GUI_DIR="$RUNNER_ROOT/gui"
NODE_DIR="$RUNNER_ROOT/.runtime/node/current"

echo "[AgentLab Runner] Starting Web GUI..."
echo

if [ -d "$NODE_DIR" ]; then
  export PATH="$NODE_DIR:$PATH"
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[Error] Node.js not found. Please run setup first."
  exit 1
fi

cd "$GUI_DIR"
GUI_PORT="${AGENTLAB_GUI_PORT:-18765}"
echo "Starting server at http://localhost:${GUI_PORT}"
echo "Browser will open automatically..."
echo
echo "Press Ctrl+C to stop the server"
echo

node server.cjs
