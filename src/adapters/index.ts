import type { AiAdapter } from './types';
import { ClaudeAdapter } from './claude';
import { CodexAdapter } from './codex';

export function createAdapter(name: string): AiAdapter {
  if (name === 'codex') return new CodexAdapter();
  return new ClaudeAdapter();
}

export type { AiResult, AiAdapter } from './types';
export { type ClaudeResult, isClaudeResult } from './claude';
