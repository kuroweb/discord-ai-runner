import { query } from '@anthropic-ai/claude-agent-sdk';
import type { AiAdapter, AiRunOptions } from '../types';
import type { ClaudeResult } from './types';
import { appendAssistantText, buildResultFromEvent } from './events';

export function createClaudeAdapter(): AiAdapter {
  async function run(
    prompt: string,
    sessionId: string | undefined,
    options: AiRunOptions,
  ): Promise<ClaudeResult> {
    const { onChunk, signal, requestApproval } = options;
    const readOnlyTools = new Set(['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'TodoWrite']);
    let accumulated = '';
    let finalResult: ClaudeResult | null = null;

    const queryInstance = query({
      prompt,
      options: {
        cwd: process.cwd(),
        permissionMode: 'default',
        ...(sessionId ? { resume: sessionId } : {}),
        canUseTool: async (toolName: string, input: Record<string, unknown>) => {
          if (readOnlyTools.has(toolName)) {
            return { behavior: 'allow' as const, updatedInput: input };
          }
          if (!requestApproval) {
            return { behavior: 'deny' as const, message: 'Approval handler not configured' };
          }

          const decision = await requestApproval({ toolName, input });
          if (decision === 'approve' || decision === 'approve-all') {
            return { behavior: 'allow' as const, updatedInput: input };
          }
          return { behavior: 'deny' as const, message: 'Denied by user' };
        },
      },
    }) as any;

    signal?.addEventListener(
      'abort',
      () => {
        if (typeof queryInstance.cancel === 'function') {
          queryInstance.cancel();
        }
      },
      { once: true },
    );

    for await (const event of queryInstance) {
      accumulated = appendAssistantText(event, accumulated, onChunk);
      const result = buildResultFromEvent(event, accumulated);
      if (result) finalResult = result;
    }

    return finalResult ?? {
      result: accumulated,
      session_id: sessionId ?? '',
      model: '',
      input_tokens: 0,
      output_tokens: 0,
      context_window: 0,
      duration_api_ms: 0,
    };
  }

  return { run };
}
