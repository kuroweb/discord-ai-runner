import type { ChatInputCommandInteraction } from 'discord.js'
import { resolveThreadCwd } from '../cwd'
import type { CommandDependencies } from './types'

export async function handleClose(
  interaction: ChatInputCommandInteraction,
  { state, scheduler, approvalManager }: CommandDependencies,
): Promise<void> {
  const threadId = interaction.channelId

  const lines = ['🔒 スレッドを閉じました。', '']
  lines.push(`📁 作業ディレクトリ: \`${resolveThreadCwd(state, threadId)}\``)
  const sessionId = state.getSession(threadId)
  if (sessionId) lines.push(`📚 セッション: \`${sessionId}\``)

  scheduler.abort(threadId)
  approvalManager.clearAutoApprove(threadId)
  state.closeThread(threadId)
  state.save()

  await interaction.reply(lines.join('\n'))
  if (interaction.channel?.isThread()) {
    await interaction.channel.setArchived(true)
  }
}
