import type { ChatInputCommandInteraction } from 'discord.js'
import type { CommandDependencies } from './types'

export async function handleReset(
  interaction: ChatInputCommandInteraction,
  { state, scheduler, approvalManager }: CommandDependencies,
): Promise<void> {
  const threadId = interaction.channelId
  scheduler.abort(threadId)
  state.clearSession(threadId)
  state.clearThreadCwd(threadId)
  approvalManager.clearAutoApprove(threadId)
  state.save()
  await interaction.reply('セッションと作業ディレクトリをリセットしました。')
}
