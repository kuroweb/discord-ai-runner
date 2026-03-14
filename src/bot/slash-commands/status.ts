import type { ChatInputCommandInteraction } from 'discord.js'
import { formatStatus } from '../messages'
import type { CommandDependencies } from './types'

export async function handleStatus(
  interaction: ChatInputCommandInteraction,
  { state }: Pick<CommandDependencies, 'state'>,
): Promise<void> {
  const usage = state.getUsage(interaction.channelId)
  const content = usage
    ? formatStatus(usage)
    : '（このセッションはまだ利用データがありません）'
  await interaction.reply(content)
}
