import type { AiAdapter } from './types'
import { createClaudeAdapter } from './claude'
import { createCodexAdapter } from './codex'

export const createAdapter = (name: string): AiAdapter => {
  switch (name) {
    case 'codex':
      return createCodexAdapter()
    default:
      return createClaudeAdapter()
  }
}
