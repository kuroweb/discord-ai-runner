import type { AiResult } from '../types'

export interface ClaudeResult extends AiResult {
  model: string
  input_tokens: number
  output_tokens: number
  context_window: number
  duration_api_ms: number
}

export function isClaudeResult(r: AiResult): r is ClaudeResult {
  return 'model' in r
}
