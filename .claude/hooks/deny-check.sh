#!/usr/bin/env bash
set -euo pipefail

readonly TS="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"

# .env からログ有効フラグを読み込む
[[ -f "${CLAUDE_PROJECT_DIR}/.env" ]] && source "${CLAUDE_PROJECT_DIR}/.env"
readonly HOOK_LOG="${HOOK_LOG:-false}"
readonly LOG_FILE="${CLAUDE_PROJECT_DIR}/logs/deny-check.log"

log() {
  [[ "$HOOK_LOG" != "true" ]] && return 0
  mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
  printf '%s\n' "$1" >>"$LOG_FILE" 2>/dev/null || true
}

deny() {
  local reason="$1"
  local cmd_json="null"
  [[ -n "${hook_command:-}" ]] && cmd_json="$(printf '%s' "$hook_command" | jq -Rs .)"
  log "{\"timestamp\":\"${TS}\",\"decision\":\"deny\",\"reason\":\"${reason}\",\"command\":${cmd_json}}"
  echo "$reason" >&2
  exit 2
}

allow() {
  local cmd_json
  cmd_json="$(printf '%s' "$hook_command" | jq -Rs .)"
  log "{\"timestamp\":\"${TS}\",\"decision\":\"allow\",\"command\":${cmd_json}}"
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
hook_command="$(
  echo "$input" | jq -r '
    .tool_input.command
    // .toolInput.command
    // .command
    // empty
  '
)"

if [[ -z "${hook_command}" ]]; then
  deny "Command not found in hook payload (fail-closed)"
fi

# settings.json を正本として deny パターンを読み込む
readonly SETTINGS_FILE="${CLAUDE_PROJECT_DIR}/.claude/settings.json"
if [[ ! -f "$SETTINGS_FILE" ]]; then
  deny "settings.json not found (fail-closed)"
fi

# permissions.deny から Bash(...) パターンを抽出してマッチング
# パターン形式: "Bash(prefix:*)" → prefix部分をglobとして使用
while IFS= read -r deny_pattern; do
  if [[ "$deny_pattern" =~ ^Bash\((.+)\)$ ]]; then
    inner="${BASH_REMATCH[1]}"
    # 末尾の :* を除去して glob プレフィックスにする
    glob="${inner%:*}*"
    if [[ "$hook_command" == $glob ]]; then
      deny "Blocked by deny rule: ${deny_pattern}"
    fi
  fi
done < <(jq -r '.permissions.deny[]?' "$SETTINGS_FILE")

allow
