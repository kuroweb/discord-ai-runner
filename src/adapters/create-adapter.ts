import type { AiAdapter } from './types'
import { createClaudeAdapter } from './claude'
import { createCodexAdapter } from './codex'
import { createCursorAgentAdapter } from './cursor-agent'

export const createAdapter = (name: string): AiAdapter => {
  switch (name) {
    case 'codex':
      return createCodexAdapter()
    case 'cursor-agent':
      return createCursorAgentAdapter()
    default:
      return createClaudeAdapter()
  }
}
