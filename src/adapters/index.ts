import type { AiAdapter } from './types';
import { createClaudeAdapter } from './claude';
import { createCodexAdapter } from './codex';

export function createAdapter(name: string): AiAdapter {
  if (name === 'codex') return createCodexAdapter();
  return createClaudeAdapter();
}

export type { AiResult, AiAdapter } from './types';
export { type ClaudeResult, isClaudeResult } from './claude';
