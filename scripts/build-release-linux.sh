#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNNER_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  VERSION="$(node -p "require('$RUNNER_ROOT/gui/package.json').version")"
fi

DIST_DIR="$RUNNER_ROOT/dist"
BUNDLE_NAME="AgentLab-Runner-${VERSION}-linux-x64"
STAGING_DIR="$DIST_DIR/$BUNDLE_NAME"
ARCHIVE_PATH="$DIST_DIR/$BUNDLE_NAME.tar.gz"

mkdir -p "$DIST_DIR"
rm -rf "$STAGING_DIR" "$ARCHIVE_PATH"
mkdir -p "$STAGING_DIR"

rsync -a \
  --exclude ".git/" \
  --exclude ".github/" \
  --exclude ".run/" \
  --exclude ".accounts/" \
  --exclude ".runtime/" \
  --exclude ".tools/" \
  --exclude "dist/" \
  --exclude "node_modules/" \
  --exclude "gui/node_modules/" \
  --exclude "gui/dist/" \
  --exclude "*.log" \
  "$RUNNER_ROOT/" "$STAGING_DIR/"

tar -C "$DIST_DIR" -czf "$ARCHIVE_PATH" "$BUNDLE_NAME"
echo "[release] Linux bundle created: $ARCHIVE_PATH"
