import type { ChatInputCommandInteraction } from 'discord.js'
import type { CommandDependencies } from '../types'

export const handleSession = async (
  interaction: ChatInputCommandInteraction,
  { state, scheduler, approvalManager }: CommandDependencies,
): Promise<void> => {
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
