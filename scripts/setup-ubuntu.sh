#!/usr/bin/env bash
set -euo pipefail

INSTALL_CODEX=0
INSTALL_CLAUDE=0
SKIP_NODE=0

for arg in "$@"; do
  case "$arg" in
    --codex) INSTALL_CODEX=1 ;;
    --claude) INSTALL_CLAUDE=1 ;;
    --all) INSTALL_CODEX=1; INSTALL_CLAUDE=1 ;;
    --skip-node) SKIP_NODE=1 ;;
    *)
      echo "Unknown argument: $arg"
      echo "Usage: bash runner/scripts/setup-ubuntu.sh [--codex|--claude|--all] [--skip-node]"
      exit 1
      ;;
  esac
done

if [[ $INSTALL_CODEX -eq 0 && $INSTALL_CLAUDE -eq 0 ]]; then
  INSTALL_CODEX=1
  INSTALL_CLAUDE=1
fi

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

RUNNER_PREFIX=""
if [[ -d "runner/scripts" ]]; then
  RUNNER_PREFIX="runner/"
fi

ensure_node() {
  if need_cmd node && need_cmd npm; then
    return
  fi
  if [[ $SKIP_NODE -eq 1 ]]; then
    echo "Node.js/npm not found and --skip-node is set."
    exit 1
  fi
  echo "[setup] Installing Node.js and npm..."
  if need_cmd apt-get; then
    if need_cmd sudo; then
      sudo apt-get update
      sudo apt-get install -y nodejs npm
    else
      apt-get update
      apt-get install -y nodejs npm
    fi
  else
    echo "apt-get not found. Please install Node.js >= 20 manually."
    exit 1
  fi
}

ensure_node

if [[ $INSTALL_CODEX -eq 1 ]]; then
  echo "[setup] Installing Codex CLI (@openai/codex)..."
  npm install -g @openai/codex
fi

if [[ $INSTALL_CLAUDE -eq 1 ]]; then
  echo "[setup] Installing Claude Code CLI (@anthropic-ai/claude-code)..."
  npm install -g @anthropic-ai/claude-code
fi

echo ""
echo "==== Verification ===="
if need_cmd node; then node --version; fi
if need_cmd npm; then npm --version; fi
if need_cmd codex; then codex --version || true; else echo "codex: not installed"; fi
if need_cmd claude; then claude --version || true; else echo "claude: not installed"; fi

echo ""
echo "==== Next steps ===="
echo "1) Authenticate selected CLI(s): codex login / claude login"
if [[ -n "$RUNNER_PREFIX" ]]; then
  echo "2) Install runner deps: npm --prefix runner install"
else
  echo "2) Install runner deps: npm install"
fi
echo "3) Start runner:"
echo "   RUNNER_SERVER=http://127.0.0.1:3200 RUNNER_TOKEN=xxxx bash ${RUNNER_PREFIX}scripts/start-runner.sh"
