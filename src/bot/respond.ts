import { randomUUID } from 'crypto'
import { mkdir, readdir, rm } from 'fs/promises'
import { dirname } from 'path'
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Message,
  type MessageCreateOptions,
} from 'discord.js'
import type { AiAdapter, AiInput, AiResult } from '../adapters'
import type { ApprovalMessageTarget, createApprovalManager } from './approval'
import {
  buildCompletedMessage,
  buildFailedMessage,
  buildInterruptedMessage,
  buildProgressMessage,
  splitIntoChunks,
  truncate,
  truncateTail,
} from './messages'
import {
  type createBotState,
  resolveThreadCwd,
  resolveThreadModel,
} from './state'
import { resolveAttachmentOutputDir } from './system-prompts'

const EDIT_INTERVAL_MS = 1500

export interface SendTarget {
  send(content: string | MessageCreateOptions): Promise<Message>
}

interface RespondDependencies {
  adapter: AiAdapter
  state: ReturnType<typeof createBotState>
  approvalManager: ReturnType<typeof createApprovalManager>
}

export const respond = async (
  sendTarget: SendTarget,
  approvalTarget: ApprovalMessageTarget,
  input: AiInput,
  sessionKey: string,
  signal: AbortSignal,
  dependencies: RespondDependencies,
): Promise<void> => {
  if (signal.aborted) return

  const { adapter, state, approvalManager } = dependencies
  const sessionId = state.getSession(sessionKey)
  const cancelRow = buildCancelRow()

  const thinking = await sendTarget.send({
    content: '🔄処理中...',
    components: [cancelRow],
  })

  let latestText = ''
  let dirty = false
  const startedAt = Date.now()
  let lastRenderedSec = -1

  const abortController = createRunAbortController(signal)
  const attachmentOutputDir = await createAttachmentOutputDir(sessionKey)

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
      await renderProgress(thinking, cancelRow, startedAt, latestText)
    } catch {
      // 編集失敗は無視
    }
  }, EDIT_INTERVAL_MS)

  try {
    await renderProgress(thinking, cancelRow, startedAt, latestText)

    const result = await adapter.run(input, sessionId, {
      cwd: resolveThreadCwd(state, sessionKey),
      model: resolveThreadModel(state, sessionKey),
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
          abortController,
        ),
    })

    clearInterval(interval)

    if (signal.aborted) {
      await sendInterrupted(thinking, approvalTarget, latestText)
      return
    }

    if (result.session_id) {
      state.setSession(sessionKey, result.session_id)
      state.save()
    }
    state.setUsage(sessionKey, result)

    await handleResult(result, thinking, approvalTarget, attachmentOutputDir)
  } catch (error) {
    clearInterval(interval)
    if (error instanceof DOMException && error.name === 'AbortError') {
      await sendInterrupted(thinking, approvalTarget, latestText)
      return
    }
    const message = error instanceof Error ? error.message : String(error)
    await thinking.edit({
      content: truncate(buildFailedMessage(message)),
      components: [],
    })
  }
}

const buildCancelRow = () =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger),
  )

const createRunAbortController = (signal: AbortSignal): AbortController => {
  const abortController = new AbortController()
  signal.addEventListener('abort', () => abortController.abort(), {
    once: true,
  })
  return abortController
}

const createAttachmentOutputDir = async (sessionKey: string): Promise<string> => {
  const turnId = randomUUID()
  const attachmentOutputDir = resolveAttachmentOutputDir(sessionKey, turnId)
  await mkdir(attachmentOutputDir, { recursive: true })
  return attachmentOutputDir
}

const renderProgress = async (
  thinking: Message,
  cancelRow: ActionRowBuilder<ButtonBuilder>,
  startedAt: number,
  latestText: string,
): Promise<void> => {
  await thinking.edit({
    content: truncateTail(buildProgressMessage(Date.now() - startedAt, latestText)),
    components: [cancelRow],
  })
}

const sendInterrupted = async (
  thinking: Message,
  approvalTarget: ApprovalMessageTarget,
  latestText: string,
): Promise<void> => {
  await thinking.edit({
    content: buildInterruptedMessage(''),
    components: [],
  })
  await sendChunkedText(approvalTarget, latestText)
}

const handleResult = async (
  result: AiResult,
  thinking: Message,
  approvalTarget: ApprovalMessageTarget,
  attachmentOutputDir: string,
): Promise<void> => {
  if (result.attachments && result.attachments.length > 0) {
    await thinking.edit({
      content: '✅添付付きで完了しました',
      components: [],
    })

    const content = buildCompletedMessage(result.result)
    await sendChunkedText(approvalTarget, content)

    await approvalTarget.send({
      content: `📎 添付ファイル ${result.attachments.length} 件`,
      files: result.attachments.map((attachment) => attachment.path),
    })
  } else {
    const completedContent = buildCompletedMessage(result.result)
    await thinking.edit({ content: '✅完了', components: [] })
    await sendChunkedText(approvalTarget, completedContent)
  }

  await cleanupAttachmentOutputDir(attachmentOutputDir)
}

const sendChunkedText = async (
  approvalTarget: ApprovalMessageTarget,
  text: string,
): Promise<void> => {
  if (!text.trim()) return

  for (const chunk of splitIntoChunks(text)) {
    await approvalTarget.send(chunk)
  }
}

const cleanupAttachmentOutputDir = async (outputDir: string): Promise<void> => {
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
