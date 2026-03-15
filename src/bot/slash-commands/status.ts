import type { ChatInputCommandInteraction } from 'discord.js'
import { isClaudeResult, type AiResult } from '../../adapters'
import { resolveThreadModel } from '../model'
import type { CommandDependencies } from './types'

interface StatusMetadata {
  adapterName?: string
  model?: string
  cwd?: string
  sessionId?: string
}

const STATUS_LABEL_WIDTH = 7

function formatStatusLine(label: string, value: string): string {
  return `  ${label.padEnd(STATUS_LABEL_WIDTH)} : ${value}`
}

function formatStatusSummary(metadata: StatusMetadata = {}): string {
  const adapterLabel = metadata.adapterName ?? 'unknown'
  const modelLabel = metadata.model ?? '未固定'
  const cwdLabel = metadata.cwd ?? process.cwd()
  const sessionLabel = metadata.sessionId ?? '未開始'

  return [
    '```',
    formatStatusLine('Adapter', adapterLabel),
    formatStatusLine('Model', modelLabel),
    formatStatusLine('Cwd', cwdLabel),
    formatStatusLine('Session', sessionLabel),
    formatStatusLine('Usage', 'まだ利用データがありません'),
    '```',
  ].join('\n')
}

function formatStatus(result: AiResult, metadata: StatusMetadata = {}): string {
  const adapterLabel = metadata.adapterName ?? 'unknown'
  const modelLabel =
    metadata.model ??
    (isClaudeResult(result) ? result.model : undefined) ??
    '未固定'
  const cwdLabel = metadata.cwd ?? process.cwd()
  const sessionLabel = metadata.sessionId ?? result.session_id ?? '未開始'

  if (isClaudeResult(result)) {
    const usedPct =
      result.context_window > 0
        ? ((result.input_tokens / result.context_window) * 100).toFixed(1)
        : '0.0'
    const latency = (result.duration_api_ms / 1000).toFixed(1)
    return [
      '```',
      `Current Session  (${result.model || modelLabel})`,
      formatStatusLine('Adapter', adapterLabel),
      formatStatusLine('Model', modelLabel),
      formatStatusLine('Cwd', cwdLabel),
      formatStatusLine('Session', sessionLabel),
      formatStatusLine(
        'Context',
        `${result.input_tokens.toLocaleString()} / ${result.context_window.toLocaleString()} tokens (${usedPct}% used)`,
      ),
      formatStatusLine('Output', `${result.output_tokens.toLocaleString()} tokens`),
      formatStatusLine('Latency', `${latency}s`),
      '```',
    ].join('\n')
  }

  return [
    '```',
    formatStatusLine('Adapter', adapterLabel),
    formatStatusLine('Model', modelLabel),
    formatStatusLine('Cwd', cwdLabel),
    formatStatusLine('Session', sessionLabel),
    formatStatusLine('Input', `${result.input_tokens?.toLocaleString() ?? '?'} tokens`),
    formatStatusLine('Output', `${result.output_tokens?.toLocaleString() ?? '?'} tokens`),
    '```',
  ].join('\n')
}

export async function handleStatus(
  interaction: ChatInputCommandInteraction,
  { state, adapterName }: Pick<CommandDependencies, 'state' | 'adapterName'>,
): Promise<void> {
  const threadId = interaction.channelId
  const usage = state.getUsage(threadId)
  const metadata = {
    adapterName,
    cwd: state.getThreadCwd(threadId),
    model: resolveThreadModel(state, threadId),
    sessionId: state.getSession(threadId),
  }
  const content = usage
    ? formatStatus(usage, metadata)
    : formatStatusSummary(metadata)
  await interaction.reply(content)
}
