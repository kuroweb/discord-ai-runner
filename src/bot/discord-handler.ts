import type { Client, Message } from 'discord.js'
import type { AiAdapter } from '../adapters'
import { buildThreadName } from './messages'
import {
  buildAiInputFromMessage,
  hasPdfAttachment,
  summarizeAiInput,
} from './inbound-attachments'
import { interactionRouter } from './interaction-router'
import { respond } from './respond'
import type { createBotState } from './state'
import type { createThreadScheduler } from './thread-scheduler'
import type { createApprovalManager } from './approval'

interface HandlerDependencies {
  client: Client
  adapterName: string
  adapter: AiAdapter
  state: ReturnType<typeof createBotState>
  scheduler: ReturnType<typeof createThreadScheduler>
  approvalManager: ReturnType<typeof createApprovalManager>
}

export const registerMessageHandler = (
  dependencies: HandlerDependencies,
): void => {
  const { client, adapterName, adapter, state, scheduler, approvalManager } =
    dependencies

  client.on('interactionCreate', async (interaction) => {
    await interactionRouter(interaction, dependencies)
  })

  client.on('messageCreate', async (message) => {
    if (rejectBotMessage(message)) return
    if (await rejectPdfAttachment(message, adapterName)) return

    const channel = message.channel

    if (state.isActiveThread(channel.id)) {
      if (channel.isThread() && channel.parentId) {
        const savedChannelId = state.getThreadChannelId(channel.id)
        if (savedChannelId !== channel.parentId) {
          state.setThreadChannelId(channel.id, channel.parentId)
          state.save()
        }
      }

      const input = await buildAiInputFromMessage(message)

      await enqueueResponse(
        channel.id,
        input,
        { send: (content) => message.channel.send(content) },
        message.channel,
        {
          adapter,
          state,
          scheduler,
          approvalManager,
        },
      )
      return
    }

    if (!message.mentions.has(client.user!)) return

    const rawPrompt = message.content.replace(/<[@#][!&]?\d+>/g, '').trim()
    const input = await buildAiInputFromMessage(message, { content: rawPrompt })
    const threadSummary = summarizeAiInput(input)

    const thread = await message.startThread({
      name: buildThreadName(threadSummary),
      autoArchiveDuration: 1440,
    })

    state.activateThread(thread.id, message.channelId)
    state.save()

    await enqueueResponse(thread.id, input, thread, thread, {
      adapter,
      state,
      scheduler,
      approvalManager,
    })
  })
}

const enqueueResponse = async (
  channelId: string,
  input: Parameters<typeof respond>[2],
  sendTarget: Parameters<typeof respond>[0],
  approvalChannel: Parameters<typeof respond>[1],
  dependencies: Omit<HandlerDependencies, 'client' | 'adapterName'>,
): Promise<void> => {
  const { adapter, state, scheduler, approvalManager } = dependencies
  const signal = scheduler.abort(channelId)

  await scheduler.enqueue(channelId, async () => {
    await respond(sendTarget, approvalChannel, input, channelId, signal, {
      adapter,
      state,
      approvalManager,
    })
  })
}

const rejectBotMessage = (message: Message): boolean => {
  return message.author.bot
}

const rejectPdfAttachment = async (
  message: Message,
  adapterName: string,
): Promise<boolean> => {
  const rejectsPdf = adapterName.trim().toLowerCase() === 'codex'
  if (!rejectsPdf || !hasPdfAttachment(message)) {
    return false
  }

  await message.reply(
    'Codex は現在 PDF 添付入力に対応していません。PDF なしで送るか、画像へ変換して送ってください。',
  )

  return true
}
