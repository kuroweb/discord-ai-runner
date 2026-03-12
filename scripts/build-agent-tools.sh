#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
AGENT_TOOLS_DIR="$ROOT_DIR/agent-tools"

[ -d "$AGENT_TOOLS_DIR" ] || exit 0

for tool_dir in "$AGENT_TOOLS_DIR"/*; do
  [ -d "$tool_dir" ] || continue
  [ "$(basename "$tool_dir")" = "bin" ] && continue
  [ -f "$tool_dir/package.json" ] || continue

  if rg -q '"build"[[:space:]]*:' "$tool_dir/package.json"; then
    echo "Installing agent tool deps: $(basename "$tool_dir")"
    (cd "$tool_dir" && npm install)
    echo "Building agent tool: $(basename "$tool_dir")"
    (cd "$tool_dir" && npm run build)
  fi
done
