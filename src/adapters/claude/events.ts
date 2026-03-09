import type { ClaudeResult } from './types'

export function appendAssistantText(
  event: any,
  accumulated: string,
  onChunk: (text: string) => void,
): string {
  if (event?.type !== 'assistant') return accumulated

  const content = event.message?.content
  if (!Array.isArray(content)) return accumulated

  let next = accumulated
  for (const block of content) {
    if (block.type !== 'text') continue
    next += block.text
    onChunk(next)
  }
  return next
}

export function buildResultFromEvent(
  event: any,
  fallbackText: string,
): ClaudeResult | null {
  if (event?.type !== 'result') return null

  const modelKey = Object.keys(event.modelUsage ?? {})[0] ?? ''
  const modelData = event.modelUsage?.[modelKey] ?? {}
  const totalInput =
    (event.usage?.input_tokens ?? 0) +
    (event.usage?.cache_read_input_tokens ?? 0) +
    (event.usage?.cache_creation_input_tokens ?? 0)

  return {
    result: event.result ?? fallbackText,
    session_id: event.session_id ?? '',
    model: modelKey,
    input_tokens: totalInput,
    output_tokens: event.usage?.output_tokens ?? 0,
    context_window: modelData.contextWindow ?? 0,
    duration_api_ms: event.duration_api_ms ?? 0,
  }
}
