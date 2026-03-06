import type { AiAdapter } from './types';
import { createClaudeAdapter } from './claude/index';
import { createCodexAdapter } from './codex/index';

export function createAdapter(name: string): AiAdapter {
  if (name === 'codex') return createCodexAdapter();
  return createClaudeAdapter();
}

export type { AiResult, AiAdapter } from './types';
export { type ClaudeResult, isClaudeResult } from './claude/index';
