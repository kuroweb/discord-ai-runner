import type { Client } from 'discord.js'
import type { AiAdapter } from '../adapters'
import { buildThreadName } from './messages'
import { handleSlashCommand, handleSessionSelect } from './slash-commands'
import { respond } from './respond'
import type { createBotState } from './state'
import type { createThreadTaskManager } from './thread-task-manager'
import type { createApprovalManager } from './approval-manager'

interface HandlerDependencies {
  client: Client
  adapter: AiAdapter
  state: ReturnType<typeof createBotState>
  taskManager: ReturnType<typeof createThreadTaskManager>
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
  prompt: string,
  sendTarget: Parameters<typeof respond>[0],
  approvalChannel: Parameters<typeof respond>[1],
  dependencies: Omit<HandlerDependencies, 'client'>,
): Promise<void> {
  const { adapter, state, taskManager, approvalManager } = dependencies
  const revision = taskManager.nextRevision(channelId)

  await taskManager.enqueue(channelId, async () => {
    await respond(sendTarget, approvalChannel, prompt, channelId, revision, {
      adapter,
      state,
      taskManager,
      approvalManager,
    })
  })
}

export function registerMessageHandler(
  dependencies: HandlerDependencies,
): void {
  const { client, adapter, state, taskManager, approvalManager } = dependencies

  client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction, dependencies)
      return
    }

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === 'session-select'
    ) {
      await handleSessionSelect(interaction, dependencies)
      return
    }

    if (!interaction.isButton()) return

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

    const channel = message.channel

    if (state.isActiveThread(channel.id)) {
      if (channel.isThread() && channel.parentId) {
        const savedChannelId = state.getThreadChannelId(channel.id)
        if (savedChannelId !== channel.parentId) {
          state.setThreadChannelId(channel.id, channel.parentId)
          state.save()
        }
      }

      const prompt = message.content.trim()
      if (!prompt) return

      await enqueueResponse(
        channel.id,
        prompt,
        { send: (content: string) => message.channel.send(content) },
        message.channel,
        {
          adapter,
          state,
          taskManager,
          approvalManager,
        },
      )
      return
    }

    if (!message.mentions.has(client.user!)) return

    const rawPrompt = message.content.replace(/<[@#][!&]?\d+>/g, '').trim()
    const prompt = rawPrompt || 'こんにちは'

    const thread = await message.startThread({
      name: buildThreadName(prompt),
      autoArchiveDuration: 1440,
    })

    state.activateThread(thread.id, message.channelId)
    state.save()

    await enqueueResponse(thread.id, prompt, thread, thread, {
      adapter,
      state,
      taskManager,
      approvalManager,
    })
  })
}
