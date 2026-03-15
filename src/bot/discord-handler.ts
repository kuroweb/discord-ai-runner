import type { Client } from 'discord.js'
import type { AiAdapter } from '../adapters'
import { buildThreadName } from './messages'
import {
  buildAiInputFromMessage,
  hasPdfAttachment,
  summarizeAiInput,
} from './inbound-attachments'
import {
  handleCommandButton,
  handleSlashCommand,
  handleSessionSelect,
} from './slash-commands'
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

type ApprovalDecision = 'approve' | 'deny' | 'approve-all'

function parseApprovalCustomId(
  customId: string,
): { decision: ApprovalDecision; requestId: string } | null {
  const idx = customId.indexOf(':')
  const action = idx === -1 ? customId : customId.slice(0, idx)
  const requestId = idx === -1 ? '' : customId.slice(idx + 1)
  if (!requestId) return null

  if (action === 'approve' || action === 'deny' || action === 'approve-all') {
    return { decision: action, requestId }
  }

  return null
}

async function enqueueResponse(
  channelId: string,
  input: Parameters<typeof respond>[2],
  sendTarget: Parameters<typeof respond>[0],
  approvalChannel: Parameters<typeof respond>[1],
  dependencies: Omit<HandlerDependencies, 'client' | 'adapterName'>,
): Promise<void> {
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

export function registerMessageHandler(
  dependencies: HandlerDependencies,
): void {
  const { client, adapterName, adapter, state, scheduler, approvalManager } =
    dependencies

  client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction, dependencies)
      return
    }

    if (
      interaction.isStringSelectMenu() &&
      (interaction.customId === 'session-select' ||
        interaction.customId === 'model-select')
    ) {
      await handleSessionSelect(interaction, dependencies)
      return
    }

    if (!interaction.isButton()) return

    if (await handleCommandButton(interaction, dependencies)) {
      return
    }

    if (interaction.customId === 'cancel') {
      scheduler.abort(interaction.channelId)
      await interaction.update({ components: [] })
      return
    }

    const parsed = parseApprovalCustomId(interaction.customId)
    if (!parsed) return
    const { decision, requestId } = parsed

    const resolved = approvalManager.resolveApproval(requestId, decision)
    if (!resolved) {
      await interaction.reply({
        content: 'この承認リクエストは期限切れです。',
        flags: ['Ephemeral'],
      })
      return
    }

    const messages: Record<typeof decision, string> = {
      approve: '✅ 承認しました',
      deny: '❌ 拒否しました',
      'approve-all': '⚡ このスレッドの自動承認を有効化しました',
    }

    await interaction.update({
      content: messages[decision],
      embeds: [],
      components: [],
    })
  })

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return

    const rejectsPdf = adapterName.trim().toLowerCase() === 'codex'
    if (rejectsPdf && hasPdfAttachment(message)) {
      await message.reply(
        'Codex は現在 PDF 添付入力に対応していません。PDF なしで送るか、画像へ変換して送ってください。',
      )
      return
    }

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
