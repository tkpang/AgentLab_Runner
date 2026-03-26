#!/usr/bin/env bash
set -euo pipefail

INSTALL_CODEX=0
INSTALL_CLAUDE=0
SKIP_NODE=0
SKIP_RUNNER_DEPS=0

for arg in "$@"; do
  case "$arg" in
    --codex) INSTALL_CODEX=1 ;;
    --claude) INSTALL_CLAUDE=1 ;;
    --all) INSTALL_CODEX=1; INSTALL_CLAUDE=1 ;;
    --skip-node) SKIP_NODE=1 ;;
    --skip-runner-deps) SKIP_RUNNER_DEPS=1 ;;
    *)
      echo "Unknown argument: $arg"
      echo "Usage: bash scripts/setup-ubuntu.sh [--codex|--claude|--all] [--skip-node] [--skip-runner-deps]"
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

node_major() {
  if ! need_cmd node; then
    echo "-1"
    return
  fi
  node -p "parseInt(process.versions.node.split('.')[0], 10)" 2>/dev/null || echo "-1"
}

resolve_runner_root() {
  if [[ -f "runner/package.json" ]]; then
    (cd runner && pwd)
    return
  fi
  if [[ -f "package.json" ]]; then
    pwd
    return
  fi
  echo ""
}

RUNNER_ROOT="$(resolve_runner_root)"
if [[ -z "$RUNNER_ROOT" ]]; then
  echo "Cannot locate runner root (expected package.json in current dir or ./runner)." >&2
  exit 1
fi

RUNTIME_NODE_BIN="$RUNNER_ROOT/.runtime/node/current/bin"
NPM_GLOBAL_PREFIX="$RUNNER_ROOT/.tools/npm-global"
mkdir -p "$NPM_GLOBAL_PREFIX"

export PATH="$RUNTIME_NODE_BIN:$NPM_GLOBAL_PREFIX/bin:$NPM_GLOBAL_PREFIX/node_modules/.bin:$PATH"

install_portable_node20() {
  echo "[setup] Installing portable Node.js 20 (no root required)..."
  local arch
  arch="$(uname -m)"
  case "$arch" in
    x86_64|amd64) arch="x64" ;;
    aarch64|arm64) arch="arm64" ;;
    *)
      echo "Unsupported architecture for portable Node: $arch" >&2
      exit 1
      ;;
  esac

  local runtime_root="$RUNNER_ROOT/.runtime"
  mkdir -p "$runtime_root"

  local sum_url="https://nodejs.org/dist/latest-v20.x/SHASUMS256.txt"
  local tar_name
  tar_name="$(curl -fsSL "$sum_url" | awk '{print $2}' | grep -E "node-v20\.[0-9]+\.[0-9]+-linux-${arch}\.tar\.xz$" | head -n1)"
  if [[ -z "$tar_name" ]]; then
    echo "Cannot resolve latest Node.js v20 linux tarball from ${sum_url}" >&2
    exit 1
  fi

  local tar_path="$runtime_root/$tar_name"
  local extract_root="$runtime_root/node-extract"
  rm -rf "$extract_root"
  rm -f "$tar_path"
  mkdir -p "$extract_root"

  curl -fsSL "https://nodejs.org/dist/latest-v20.x/${tar_name}" -o "$tar_path"
  tar -xJf "$tar_path" -C "$extract_root"
  local node_dir
  node_dir="$(find "$extract_root" -mindepth 1 -maxdepth 1 -type d | head -n1)"
  if [[ -z "$node_dir" ]]; then
    echo "Portable Node extracted but folder not found." >&2
    exit 1
  fi

  mkdir -p "$RUNNER_ROOT/.runtime/node"
  rm -rf "$RUNNER_ROOT/.runtime/node/current"
  mv "$node_dir" "$RUNNER_ROOT/.runtime/node/current"
  rm -rf "$extract_root"
  rm -f "$tar_path"

  export PATH="$RUNNER_ROOT/.runtime/node/current/bin:$PATH"
}

ensure_node20() {
  local major
  major="$(node_major)"
  if [[ "$major" -ge 20 ]] && need_cmd npm; then
    return
  fi

  if [[ $SKIP_NODE -eq 1 ]]; then
    echo "Node.js >= 20/npm not found and --skip-node is set." >&2
    exit 1
  fi

  if need_cmd apt-get; then
    echo "[setup] Installing Node.js 20 via NodeSource apt repo..."
    if need_cmd sudo; then
      sudo apt-get update
      sudo apt-get install -y ca-certificates curl gnupg
      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
      sudo apt-get install -y nodejs
    else
      apt-get update
      apt-get install -y ca-certificates curl gnupg
      curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
      apt-get install -y nodejs
    fi
  fi

  major="$(node_major)"
  if [[ "$major" -ge 20 ]] && need_cmd npm; then
    return
  fi

  install_portable_node20
  major="$(node_major)"
  if [[ "$major" -lt 20 ]] || ! need_cmd npm; then
    echo "Node.js >= 20/npm still unavailable after setup." >&2
    exit 1
  fi
}

ensure_node20

if [[ $INSTALL_CODEX -eq 1 ]]; then
  echo "[setup] Installing Codex CLI (@openai/codex) to local runner tools..."
  npm install -g --prefix "$NPM_GLOBAL_PREFIX" @openai/codex
fi

if [[ $INSTALL_CLAUDE -eq 1 ]]; then
  echo "[setup] Installing Claude Code CLI (@anthropic-ai/claude-code) to local runner tools..."
  npm install -g --prefix "$NPM_GLOBAL_PREFIX" @anthropic-ai/claude-code
fi

if [[ $SKIP_RUNNER_DEPS -eq 0 ]]; then
  echo "[setup] Installing runner dependencies..."
  npm --prefix "$RUNNER_ROOT" install
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
echo "2) Start runner:"
echo "   RUNNER_SERVER=http://127.0.0.1:3200 RUNNER_TOKEN=xxxx bash $RUNNER_ROOT/scripts/start-runner.sh"
