import { isClaudeResult, type AiResult } from '../adapters'
export const DISCORD_MAX_LENGTH = 2000
const DISCORD_THREAD_NAME_MAX_LENGTH = 100

export function formatStatus(result: AiResult): string {
  if (isClaudeResult(result)) {
    const usedPct =
      result.context_window > 0
        ? ((result.input_tokens / result.context_window) * 100).toFixed(1)
        : '0.0'
    const latency = (result.duration_api_ms / 1000).toFixed(1)
    return [
      '```',
      `Current Session  (${result.model})`,
      `  Context : ${result.input_tokens.toLocaleString()} / ${result.context_window.toLocaleString()} tokens (${usedPct}% used)`,
      `  Output  : ${result.output_tokens.toLocaleString()} tokens`,
      `  Latency : ${latency}s`,
      '```',
    ].join('\n')
  }

  return [
    '```',
    `  Input  : ${result.input_tokens?.toLocaleString() ?? '?'} tokens`,
    `  Output : ${result.output_tokens?.toLocaleString() ?? '?'} tokens`,
    '```',
  ].join('\n')
}

export function truncate(text: string): string {
  return text.length > DISCORD_MAX_LENGTH
    ? `${text.slice(0, DISCORD_MAX_LENGTH - 10)}\n…(省略)`
    : text
}

/** ストリーム中に末尾（最新）を表示する。2000文字超は先頭を省略 */
export function truncateTail(text: string): string {
  if (text.length <= DISCORD_MAX_LENGTH) return text
  const prefix = '…(先頭省略)\n'
  return prefix + text.slice(-(DISCORD_MAX_LENGTH - prefix.length))
}

/** 2000文字超のテキストを Discord 送信用にチャンク分割 */
export function splitIntoChunks(text: string): string[] {
  if (text.length <= DISCORD_MAX_LENGTH) return [text]
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += DISCORD_MAX_LENGTH) {
    chunks.push(text.slice(i, i + DISCORD_MAX_LENGTH))
  }
  return chunks
}

const CODE_BLOCK_OPEN = '```'
const CODE_BLOCK_CLOSE = '\n```'

/**
 * Markdown のコードブロックをチャンク内で完結させる分割。
 * Discord 2000 文字制限を守りつつ、各チャンクは必ず ``` で閉じた有効なコードブロックになる。
 * コード内容は途中で途切れてもよい（プレビュー優先）。
 *
 * @param text - 分割対象（```lang\n...\n``` 形式を想定）
 * @param maxLen - 1チャンクの最大文字数
 * @param prefix - 先頭チャンクに付けるプレフィックス（省略可）
 */
export function splitMarkdownCodeBlocksForDiscord(
  text: string,
  maxLen: number = DISCORD_MAX_LENGTH,
  prefix: string = '',
): string[] {
  const prefixPart = prefix ? prefix.trimEnd() + '\n\n' : ''
  const withPrefix = prefixPart + text
  if (withPrefix.length <= maxLen) return [withPrefix]

  const match = text.match(/^```(\w*)\n([\s\S]*?)```\s*$/s)
  if (!match) {
    return splitIntoChunks(withPrefix)
  }

  const [, lang, content] = match
  const langPart = lang || 'diff'
  const openTag = `${CODE_BLOCK_OPEN}${langPart}\n`
  const closeTag = CODE_BLOCK_CLOSE
  const overhead = openTag.length + closeTag.length
  const firstContentMax = prefixPart
    ? maxLen - prefixPart.length - overhead
    : maxLen - overhead
  const contentMax = maxLen - overhead

  if (content.length <= firstContentMax) return [withPrefix]

  const chunks: string[] = []
  chunks.push(
    prefixPart + openTag + content.slice(0, firstContentMax) + closeTag,
  )
  for (let i = firstContentMax; i < content.length; i += contentMax) {
    chunks.push(openTag + content.slice(i, i + contentMax) + closeTag)
  }
  return chunks
}

export function asQuote(text: string): string {
  return text
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')
}

export function buildProgressMessage(
  elapsedMs: number,
  latestText: string,
): string {
  const elapsedSec = Math.floor(elapsedMs / 1000)
  if (!latestText) return `🔄処理中${elapsedSec}s`
  return `🔄処理中${elapsedSec}s\n\n${latestText}`
}

export function buildCompletedMessage(text: string): string {
  if (!text.trim()) return '（応答なし）'
  return text
}

export function buildInterruptedMessage(text: string): string {
  const status =
    '⚠️中断:新しいメッセージまたはリセットにより、この応答は破棄されました'
  if (!text.trim()) return status
  return `${status}\n\n${text}`
}

export function buildFailedMessage(message: string): string {
  return `❌失敗:${message}`
}

function sliceByChars(text: string, maxChars: number): string {
  return Array.from(text).slice(0, maxChars).join('')
}

export function buildThreadName(prompt: string): string {
  const now = new Date().toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const normalizedPrompt = prompt.normalize('NFKC').replace(/\s+/g, ' ').trim()
  const summary = sliceByChars(normalizedPrompt, 20) || '新規要望'
  return `[${now}] ${summary}`.slice(0, DISCORD_THREAD_NAME_MAX_LENGTH)
}
