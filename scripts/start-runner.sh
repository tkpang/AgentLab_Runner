#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${RUNNER_TOKEN:-}" ]]; then
  echo "RUNNER_TOKEN is required"
  echo "Example:"
  echo "  RUNNER_SERVER=http://127.0.0.1:3200 RUNNER_TOKEN=xxxx bash runner/scripts/start-runner.sh"
  exit 1
fi

export RUNNER_SERVER="${RUNNER_SERVER:-http://127.0.0.1:3200}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNNER_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENTRY_TS="$RUNNER_ROOT/src/agentlab-runner.ts"
if [[ ! -f "$ENTRY_TS" ]]; then
  echo "Cannot find runner entry file: $ENTRY_TS"
  exit 1
fi

export PATH="$RUNNER_ROOT/.runtime/node/current/bin:$RUNNER_ROOT/.tools/npm-global/bin:$RUNNER_ROOT/.tools/npm-global/node_modules/.bin:$PATH"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx not found. Please run scripts/setup-ubuntu.sh first."
  exit 1
fi

exec npx tsx "$ENTRY_TS"
