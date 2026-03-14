import type {
  ChatInputCommandInteraction,
  StringSelectMenuInteraction,
} from 'discord.js'
import type { CommandDependencies } from './types'

export async function handleSession(
  interaction: ChatInputCommandInteraction,
  { state, scheduler, approvalManager }: CommandDependencies,
): Promise<void> {
  const threadId = interaction.channelId
  const sessionId = interaction.options.getString('id')?.trim()

  if (!sessionId) {
    const currentSessionId = state.getSession(threadId)
    await interaction.reply(
      currentSessionId
        ? `📚 現在のセッション: \`${currentSessionId}\``
        : '📚 現在のセッションはありません。',
    )
    return
  }

  scheduler.abort(threadId)
  state.clearSession(threadId)
  state.setSession(threadId, sessionId)
  approvalManager.clearAutoApprove(threadId)
  state.save()
  await interaction.reply(`📚 セッションを \`${sessionId}\` に切り替えました。`)
}

export async function handleSessionSelect(
  interaction: StringSelectMenuInteraction,
  { state, scheduler, approvalManager }: CommandDependencies,
): Promise<void> {
  const threadId = interaction.channelId
  const sessionId = interaction.values[0]
  if (!sessionId) return

  scheduler.abort(threadId)
  state.clearSession(threadId)
  state.setSession(threadId, sessionId)
  approvalManager.clearAutoApprove(threadId)
  state.save()

  await interaction.update({
    content: `📚 セッションを \`${sessionId}\` に切り替えました。`,
    components: [],
  })
}
