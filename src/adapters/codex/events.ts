import type { AiResult } from '../types';
import type { CodexRunState } from './types';

export function applyCodexEvent(
  event: any,
  state: CodexRunState,
  onChunk: (text: string) => void,
): void {
  if (event.type === 'thread.started') {
    state.sessionIdResult = event.thread_id ?? '';
    return;
  }

  if (event.type === 'item.completed' && event.item?.type === 'agent_message') {
    const text = event.item.text ?? '';
    if (!text) return;
    state.streamText += (state.streamText ? '\n\n' : '') + text;
    onChunk(state.streamText);
    return;
  }

  if (event.type === 'turn.completed') {
    state.inputTokens = event.usage?.input_tokens;
    state.outputTokens = event.usage?.output_tokens;
  }
}

export function toAiResult(state: CodexRunState): AiResult {
  return {
    result: state.streamText,
    session_id: state.sessionIdResult,
    input_tokens: state.inputTokens,
    output_tokens: state.outputTokens,
  };
}
