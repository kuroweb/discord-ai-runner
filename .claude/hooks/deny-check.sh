#!/usr/bin/env bash
set -euo pipefail

readonly LOG_FILE="${CLAUDE_HOOK_LOG_FILE:-/tmp/claude-deny-check.log}"
readonly TS="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"

log() {
  # 監査用ログ（失敗しても本処理は継続）
  printf '%s %s\n' "$TS" "$1" >>"$LOG_FILE" 2>/dev/null || true
}

deny() {
  local reason="$1"
  log "DENY reason=${reason}"
  printf '{"decision":"deny","reason":"%s"}\n' "$reason"
  exit 0
}

allow() {
  log "ALLOW"
  printf '{"decision":"allow"}\n'
  exit 0
}

input="$(cat || true)"
if [[ -z "${input}" ]]; then
  deny "Empty hook input (fail-closed)"
fi

if ! command -v jq >/dev/null 2>&1; then
  deny "jq is required for deny-check.sh (fail-closed)"
fi

# Claude Hook 入力 JSON の command を取得
command="$(
  echo "$input" | jq -r '
    .tool_input.command
    // .toolInput.command
    // .command
    // empty
  '
)"

if [[ -z "${command}" ]]; then
  deny "Command not found in hook payload (fail-closed)"
fi

deny_regex='(rm[[:space:]]+-rf[[:space:]]+/|(^|[[:space:]])sudo([[:space:]]|$)|curl[[:space:]].*\|[[:space:]]*sh|wget[[:space:]].*\|[[:space:]]*sh)'
if echo "$command" | grep -Eiq "$deny_regex"; then
  deny "Dangerous command detected"
fi

allow
