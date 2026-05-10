import type { Client, Message } from 'discord.js'
import type { AiAdapter } from '../adapters'
import type { createBatchRunner } from '../batch'
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
  batchRunner: ReturnType<typeof createBatchRunner>
}

export const registerMessageHandler = (
  dependencies: HandlerDependencies,
): void => {
  const {
    client,
    adapterName,
    adapter,
    state,
    scheduler,
    approvalManager,
    batchRunner,
  } = dependencies
  const responseDependencies = {
    adapter,
    state,
    scheduler,
    approvalManager,
    batchRunner,
  }

  client.on('interactionCreate', async (interaction) => {
    await interactionRouter(interaction, dependencies)
  })

  client.on('messageCreate', async (message) => {
    if (rejectBotMessage(message)) return
    if (await rejectPdfAttachment(message, adapterName)) return
    if (await handleThreadMessage(message, state, responseDependencies)) return
    if (
      await handleChannelMessage(message, client, state, responseDependencies)
    )
      return
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

const handleThreadMessage = async (
  message: Message,
  state: ReturnType<typeof createBotState>,
  dependencies: Omit<HandlerDependencies, 'client' | 'adapterName'>,
): Promise<boolean> => {
  if (!state.isActiveThread(message.channel.id)) return false

  syncThreadParentChannelId(message.channel, state)
  const input = await buildAiInputFromMessage(message)
  const channelTarget = {
    send: (content: string) =>
      (message.channel as { send(value: string): Promise<Message> }).send(
        content,
      ),
  }

  await enqueueResponse(
    message.channel.id,
    input,
    channelTarget,
    channelTarget,
    dependencies,
  )

  return true
}

const handleChannelMessage = async (
  message: Message,
  client: Client,
  state: ReturnType<typeof createBotState>,
  dependencies: Omit<HandlerDependencies, 'client' | 'adapterName'>,
): Promise<boolean> => {
  if (!isMentionToCurrentBot(message, client)) return false

  const rawPrompt = message.content.replace(/<[@#][!&]?\d+>/g, '').trim()
  const input = await buildAiInputFromMessage(message, { content: rawPrompt })
  const threadSummary = summarizeAiInput(input)

  const thread = await message.startThread({
    name: buildThreadName(threadSummary),
    autoArchiveDuration: 1440,
  })

  state.activateThread(thread.id, message.channelId)
  state.save()

  await enqueueResponse(thread.id, input, thread, thread, dependencies)
  return true
}

const isMentionToCurrentBot = (message: Message, client: Client): boolean => {
  if (!client.user) return false

  return message.mentions.has(client.user.id)
}

const syncThreadParentChannelId = (
  channel: Message['channel'],
  state: ReturnType<typeof createBotState>,
): void => {
  if (!channel.isThread() || !channel.parentId) {
    return
  }

  const savedChannelId = state.getThreadChannelId(channel.id)
  if (savedChannelId !== channel.parentId) {
    state.setThreadChannelId(channel.id, channel.parentId)
    state.save()
  }
}

const enqueueResponse = async (
  channelId: string,
  input: Parameters<typeof respond>[2],
  sendTarget: Parameters<typeof respond>[0],
  approvalChannel: Parameters<typeof respond>[1],
  dependencies: Omit<HandlerDependencies, 'client' | 'adapterName'>,
): Promise<void> => {
  const { adapter, state, scheduler, approvalManager } = dependencies

  await scheduler.enqueue(channelId, async (signal) => {
    await respond(sendTarget, approvalChannel, input, channelId, signal, {
      adapter,
      state,
      approvalManager,
    })
  })
}
