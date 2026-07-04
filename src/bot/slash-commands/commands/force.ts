import type { ChatInputCommandInteraction } from 'discord.js'
import type { CommandDependencies } from '../types'

export async function handleForce(
  interaction: ChatInputCommandInteraction,
  { state, adapterName }: Pick<CommandDependencies, 'state' | 'adapterName'>,
): Promise<void> {
  if (adapterName.trim().toLowerCase() !== 'cursor-agent') {
    await interaction.reply({
      content: `このコマンドは AI_ADAPTER=cursor-agent 専用です（現在: ${adapterName}）。`,
      flags: ['Ephemeral'],
    })
    return
  }

  const threadId = interaction.channelId
  const enabled = interaction.options.getBoolean('enabled')

  if (enabled === null) {
    const current = state.isThreadForceEnabled(threadId)
    await interaction.reply(
      current
        ? '⚡ 承認スキップ（--force）: 有効。すべてのツール実行が承認なしで行われます。'
        : '🛡️ 承認スキップ（--force）: 無効。安全と分類された操作のみ自動実行されます（--auto-review）。',
    )
    return
  }

  state.setThreadForce(threadId, enabled)
  await interaction.reply(
    enabled
      ? '⚡ このスレッドの承認スキップ（--force）を有効にしました。次の応答から、すべてのツール実行が承認なしで行われます。作業が終わったら `/force enabled:False` で戻してください。'
      : '🛡️ このスレッドの承認スキップ（--force）を無効にしました。次の応答から --auto-review に戻ります。',
  )
}
