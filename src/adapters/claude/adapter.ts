import { spawn } from 'child_process'
import { listSessions, query } from '@anthropic-ai/claude-agent-sdk'
import type { AiAdapter, AiRunOptions } from '../types'
import { collectAttachments } from '../attachments'
import {
  ATTACHMENT_ROOT_DIR,
  renderSystemPrompt,
} from '../../bot/prompts/system-prompt'
import type { ClaudeResult } from './types'
import { appendAssistantText, buildResultFromEvent } from './events'

export function createClaudeAdapter(): AiAdapter {
  async function run(
    prompt: string,
    sessionId: string | undefined,
    options: AiRunOptions,
  ): Promise<ClaudeResult> {
    const { onChunk, signal, cwd, requestApproval, attachmentOutputDir } =
      options
    const policyAppend = renderSystemPrompt({ attachmentOutputDir })
    const readOnlyTools = new Set([
      'Read',
      'Glob',
      'Grep',
      'WebSearch',
      'WebFetch',
      'TodoWrite',
    ])
    let accumulated = ''
    let finalResult: ClaudeResult | null = null

    const queryInstance = query({
      prompt,
      options: {
        cwd: cwd ?? process.cwd(),
        settingSources: ['project', 'local', 'user'],
        permissionMode: 'default',
        ...(policyAppend
          ? {
              systemPrompt: {
                type: 'preset' as const,
                preset: 'claude_code' as const,
                append: policyAppend,
              },
            }
          : {}),
        spawnClaudeCodeProcess: (spawnOptions) =>
          spawn(
            spawnOptions.command,
            [...spawnOptions.args, '--add-dir', ATTACHMENT_ROOT_DIR],
            {
              cwd: spawnOptions.cwd,
              env: spawnOptions.env,
              signal: spawnOptions.signal,
              stdio: ['pipe', 'pipe', 'pipe'],
            },
          ),
        ...(sessionId ? { resume: sessionId } : {}),
        canUseTool: async (
          toolName: string,
          input: Record<string, unknown>,
        ) => {
          if (readOnlyTools.has(toolName)) {
            return { behavior: 'allow' as const, updatedInput: input }
          }
          if (!requestApproval) {
            return {
              behavior: 'deny' as const,
              message: 'Approval handler not configured',
            }
          }

          const decision = await requestApproval({ toolName, input })
          if (decision === 'approve' || decision === 'approve-all') {
            return { behavior: 'allow' as const, updatedInput: input }
          }
          return { behavior: 'deny' as const, message: 'Denied by user' }
        },
      },
    }) as any

    signal?.addEventListener(
      'abort',
      () => {
        if (typeof queryInstance.cancel === 'function') {
          queryInstance.cancel()
        }
      },
      { once: true },
    )

    for await (const event of queryInstance) {
      accumulated = appendAssistantText(event, accumulated, onChunk)
      const result = buildResultFromEvent(event, accumulated)
      if (result) finalResult = result
    }

    const attachments = await collectAttachments(attachmentOutputDir)

    return finalResult
      ? {
          ...finalResult,
          attachments,
        }
      : {
          result: accumulated,
          session_id: sessionId ?? '',
          model: '',
          input_tokens: 0,
          output_tokens: 0,
          context_window: 0,
          duration_api_ms: 0,
          attachments,
        }
  }

  async function listClaudeSessions(
    cwd: string,
    options?: { limit?: number },
  ) {
    const sessions = await listSessions({
      dir: cwd,
      limit: options?.limit ?? 10,
    })

    return sessions.map((session) => ({
      id: session.sessionId,
      summary: session.summary,
      lastModified: session.lastModified,
      gitBranch: session.gitBranch,
      cwd: session.cwd,
    }))
  }

  return { run, listSessions: listClaudeSessions }
}
