import { randomUUID } from 'crypto'
import { mkdir, readdir, rm } from 'fs/promises'
import { dirname } from 'path'
import { resolveAttachmentOutputDir } from './prompts/system-prompt'
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Message,
  type MessageCreateOptions,
} from 'discord.js'
import type { AiAdapter } from '../adapters'
import type { createBotState } from './state'
import type { ApprovalMessageTarget } from './approval-manager'
import type { createApprovalManager } from './approval-manager'
import { resolveThreadCwd } from './cwd'
import {
  buildCompletedMessage,
  buildFailedMessage,
  buildInterruptedMessage,
  buildProgressMessage,
  splitIntoChunks,
  truncate,
  truncateTail,
} from './messages'

const EDIT_INTERVAL_MS = 1500

async function cleanupAttachmentOutputDir(outputDir: string): Promise<void> {
  await rm(outputDir, { recursive: true, force: true })

  const threadDir = dirname(outputDir)
  try {
    const remaining = await readdir(threadDir)
    if (remaining.length === 0) {
      await rm(threadDir, { recursive: true, force: true })
    }
  } catch {
    // cleanup failure is non-fatal
  }
}

export interface SendTarget {
  send(content: string | MessageCreateOptions): Promise<Message>
}

interface RespondDependencies {
  adapter: AiAdapter
  state: ReturnType<typeof createBotState>
  approvalManager: ReturnType<typeof createApprovalManager>
}

export async function respond(
  sendTarget: SendTarget,
  approvalTarget: ApprovalMessageTarget,
  prompt: string,
  sessionKey: string,
  signal: AbortSignal,
  dependencies: RespondDependencies,
): Promise<void> {
  const { adapter, state, approvalManager } = dependencies

  if (signal.aborted) {
    return
  }

  const sessionId = state.getSession(sessionKey)
  const cancelRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger),
  )
  const thinking = await sendTarget.send({
    content: '🔄処理中...',
    components: [cancelRow],
  })

  let latestText = ''
  let dirty = false
  const startedAt = Date.now()
  let lastRenderedSec = -1
  const abortController = new AbortController()
  signal.addEventListener('abort', () => abortController.abort(), {
    once: true,
  })
  const turnId = randomUUID()
  const attachmentOutputDir = resolveAttachmentOutputDir(sessionKey, turnId)

  await mkdir(attachmentOutputDir, { recursive: true })

  const interval = setInterval(async () => {
    if (signal.aborted) {
      clearInterval(interval)
      return
    }

    const elapsedSec = Math.floor((Date.now() - startedAt) / 1000)
    if (!dirty && elapsedSec === lastRenderedSec) return

    dirty = false
    lastRenderedSec = elapsedSec

    try {
      await thinking.edit({
        content: truncateTail(
          buildProgressMessage(Date.now() - startedAt, latestText),
        ),
        components: [cancelRow],
      })
    } catch {
      // 編集失敗は無視
    }
  }, EDIT_INTERVAL_MS)

  try {
    await thinking.edit({
      content: truncateTail(
        buildProgressMessage(Date.now() - startedAt, latestText),
      ),
      components: [cancelRow],
    })

    const result = await adapter.run(prompt, sessionId, {
      cwd: resolveThreadCwd(state, sessionKey),
      model: state.getThreadModel(sessionKey),
      attachmentOutputDir,
      signal: abortController.signal,
      onChunk: (text) => {
        latestText = text
        dirty = true
      },
      requestApproval: async (request) =>
        approvalManager.requestApproval(
          approvalTarget,
          sessionKey,
          request.toolName,
          request.input,
        ),
    })

    clearInterval(interval)

    if (signal.aborted) {
      await thinking.edit({
        content: buildInterruptedMessage(''),
        components: [],
      })
      if (latestText.trim()) {
        for (const chunk of splitIntoChunks(latestText)) {
          await approvalTarget.send(chunk)
        }
      }
      return
    }

    if (result.session_id) {
      state.setSession(sessionKey, result.session_id)
      state.save()
    }
    state.setUsage(sessionKey, result)

    if (result.attachments && result.attachments.length > 0) {
      await thinking.edit({
        content: '✅添付付きで完了しました',
        components: [],
      })

      const content = buildCompletedMessage(result.result)
      if (content.trim()) {
        for (const chunk of splitIntoChunks(content)) {
          await approvalTarget.send(chunk)
        }
      }

      await approvalTarget.send({
        content: `📎 添付ファイル ${result.attachments.length} 件`,
        files: result.attachments.map((attachment) => attachment.path),
      })

      await cleanupAttachmentOutputDir(attachmentOutputDir)
      return
    }

    const completedContent = buildCompletedMessage(result.result)
    await thinking.edit({ content: '✅完了', components: [] })
    if (completedContent.trim()) {
      for (const chunk of splitIntoChunks(completedContent)) {
        await approvalTarget.send(chunk)
      }
    }
    await cleanupAttachmentOutputDir(attachmentOutputDir)
  } catch (error) {
    clearInterval(interval)
    if (error instanceof DOMException && error.name === 'AbortError') {
      await thinking.edit({
        content: buildInterruptedMessage(''),
        components: [],
      })
      if (latestText.trim()) {
        for (const chunk of splitIntoChunks(latestText)) {
          await approvalTarget.send(chunk)
        }
      }
      return
    }
    const message = error instanceof Error ? error.message : String(error)
    await thinking.edit({
      content: truncate(buildFailedMessage(message)),
      components: [],
    })
  }
}
