import { isClaudeResult, type AiResult } from '../adapters';

const DISCORD_MAX_LENGTH = 2000;
const DISCORD_THREAD_NAME_MAX_LENGTH = 100;

export function formatStatus(result: AiResult): string {
  if (isClaudeResult(result)) {
    const usedPct = result.context_window > 0
      ? ((result.input_tokens / result.context_window) * 100).toFixed(1)
      : '0.0';
    const latency = (result.duration_api_ms / 1000).toFixed(1);
    return [
      '```',
      `Current Session  (${result.model})`,
      `  Context : ${result.input_tokens.toLocaleString()} / ${result.context_window.toLocaleString()} tokens (${usedPct}% used)`,
      `  Output  : ${result.output_tokens.toLocaleString()} tokens`,
      `  Latency : ${latency}s`,
      '```',
    ].join('\n');
  }

  return [
    '```',
    `  Input  : ${result.input_tokens?.toLocaleString() ?? '?'} tokens`,
    `  Output : ${result.output_tokens?.toLocaleString() ?? '?'} tokens`,
    '```',
  ].join('\n');
}

export function truncate(text: string): string {
  return text.length > DISCORD_MAX_LENGTH
    ? `${text.slice(0, DISCORD_MAX_LENGTH - 10)}\n…(省略)`
    : text;
}

export function asQuote(text: string): string {
  return text
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
}

export function buildProgressMessage(elapsedMs: number, latestText: string): string {
  const elapsedSec = Math.floor(elapsedMs / 1000);
  if (!latestText) return `🔄処理中${elapsedSec}s`;
  return `🔄処理中${elapsedSec}s\n\n${latestText}`;
}

export function buildCompletedMessage(text: string): string {
  if (!text.trim()) return '✅完了（応答なし）';
  return `✅完了\n\n${text}`;
}

export function buildFailedMessage(message: string): string {
  return `❌失敗:${message}`;
}

export function buildThreadName(): string {
  const now = new Date().toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `CodexBot ${now}`.slice(0, DISCORD_THREAD_NAME_MAX_LENGTH);
}
