#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${RUNNER_TOKEN:-}" ]]; then
  echo "RUNNER_TOKEN is required"
  echo "Example:"
  echo "  RUNNER_SERVER=http://127.0.0.1:3200 RUNNER_TOKEN=xxxx bash runner/scripts/start-runner.sh"
  exit 1
fi

export RUNNER_SERVER="${RUNNER_SERVER:-http://127.0.0.1:3200}"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx not found. Please install Node.js >= 20 first."
  exit 1
fi

ENTRY_TS="runner/src/agentlab-runner.ts"
if [[ ! -f "$ENTRY_TS" ]]; then
  ENTRY_TS="src/agentlab-runner.ts"
fi
if [[ ! -f "$ENTRY_TS" ]]; then
  echo "Cannot find runner entry file. Expected runner/src/agentlab-runner.ts or src/agentlab-runner.ts"
  exit 1
fi

exec npx tsx "$ENTRY_TS"
