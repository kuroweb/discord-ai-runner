import type { ChatInputCommandInteraction } from 'discord.js'
import type { CommandDependencies } from '../types'

export async function handleAutoApprove(
  interaction: ChatInputCommandInteraction,
  {
    approvalManager,
    adapterName,
  }: Pick<CommandDependencies, 'approvalManager' | 'adapterName'>,
): Promise<void> {
  if (adapterName.trim().toLowerCase() === 'cursor-agent') {
    await interaction.reply({
      content:
        'cursor-agent は承認リクエストを発行しないため、このコマンドは使えません。代わりに `/force` を使ってください。',
      flags: ['Ephemeral'],
    })
    return
  }

  const threadId = interaction.channelId
  const enabled = interaction.options.getBoolean('enabled')

  if (enabled === null) {
    const current = approvalManager.isAutoApproveEnabled(threadId)
    await interaction.reply(
      current
        ? '⚡ 自動承認: 有効。高リスク操作を除き、承認なしでツールを実行します。'
        : '🛡️ 自動承認: 無効。ツール実行のたびに承認ボタンで確認します。',
    )
    return
  }

  if (enabled) {
    approvalManager.enableAutoApprove(threadId)
    await interaction.reply(
      '⚡ このスレッドの自動承認を有効にしました。高リスク操作（rm -rf, sudo 等）だけは引き続き毎回確認します。',
    )
  } else {
    approvalManager.clearAutoApprove(threadId)
    await interaction.reply(
      '🛡️ このスレッドの自動承認を無効にしました。次のツール実行から承認ボタンで確認します。',
    )
  }
}
