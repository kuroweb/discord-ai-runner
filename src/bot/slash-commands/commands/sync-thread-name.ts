import type { ChatInputCommandInteraction } from 'discord.js'
import { resolveThreadCwd } from '../../state'
import { mergeThreadNameWithTimestamp } from '../../messages'
import type { CommandDependencies } from '../types'

function canRenameChannel(
  channel: ChatInputCommandInteraction['channel'],
): channel is ChatInputCommandInteraction['channel'] & {
  name: string
  setName: (name: string) => Promise<unknown>
} {
  return (
    !!channel &&
    'name' in channel &&
    typeof channel.name === 'string' &&
    'setName' in channel &&
    typeof channel.setName === 'function'
  )
}

export async function handleTitle(
  interaction: ChatInputCommandInteraction,
  { adapter, state }: CommandDependencies,
): Promise<void> {
  if (!canRenameChannel(interaction.channel)) {
    await interaction.reply('❌ このチャンネルではスレッド名を変更できません。')
    return
  }

  if (!adapter.listSessions) {
    await interaction.reply(
      '❌ この AI adapter は session summary の取得に未対応です。',
    )
    return
  }

  const sessionId = state.getSession(interaction.channelId)
  if (!sessionId) {
    await interaction.reply('❌ 現在のスレッドに紐づくセッションがありません。')
    return
  }

  await interaction.deferReply()

  let nextSummary: string
  try {
    const cwd = resolveThreadCwd(state, interaction.channelId)
    const sessions = await adapter.listSessions(cwd, { limit: 50 })
    const session = sessions.find((candidate) => candidate.id === sessionId)
    nextSummary = session?.summary.trim() ?? ''

    if (!nextSummary) {
      await interaction.editReply(
        `❌ セッション \`${sessionId}\` の summary を取得できませんでした。`,
      )
      return
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'スレッド名の候補取得に失敗しました。'
    await interaction.editReply(`❌ ${message}`)
    return
  }

  const nextName = mergeThreadNameWithTimestamp(
    interaction.channel.name,
    nextSummary,
  )

  try {
    await interaction.channel.setName(nextName)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'スレッド名の変更に失敗しました。'
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(`❌ ${message}`)
    } else {
      await interaction.reply(`❌ ${message}`)
    }
    return
  }

  const response = `📝 スレッド名を \`${nextName}\` に変更しました。`
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(response)
    return
  }
  await interaction.reply(response)
}
