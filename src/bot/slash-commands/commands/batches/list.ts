import type {
  ChatInputCommandInteraction,
  StringSelectMenuInteraction,
} from 'discord.js'
import type { BatchJob } from '../../../../batch'
import type { CommandDependencies } from '../../types'
import { buildJobSelectRow } from './lib/components'
import { LIST_TARGET_SELECT_ID } from './lib/constants'

export async function handleBatchListCommand(
  interaction: ChatInputCommandInteraction,
  { state }: Pick<CommandDependencies, 'state'>,
): Promise<void> {
  const jobs = state.listBatchJobs()
  if (jobs.length === 0) {
    await interaction.reply('📦 対象ジョブはありません。')
    return
  }
  await interaction.reply({
    content: '一覧から確認したいジョブを選択してください。',
    components: [
      buildJobSelectRow(LIST_TARGET_SELECT_ID, jobs, interaction.guild),
    ],
    flags: ['Ephemeral'],
  })
}

export async function handleBatchListSelect(
  interaction: StringSelectMenuInteraction,
  { state }: Pick<CommandDependencies, 'state'>,
): Promise<boolean> {
  if (interaction.customId !== LIST_TARGET_SELECT_ID) return false

  const jobId = interaction.values[0]
  if (!jobId) {
    await interaction.update({
      content: '❌ 対象ジョブが選択されていません。',
      components: [],
    })
    return true
  }

  const job = state.getBatchJob(jobId)
  const jobs = state.listBatchJobs()
  if (!job) {
    await interaction.update({
      content:
        '❌ ジョブが見つかりません。再度 `/batch list` を実行してください。',
      components: [],
    })
    return true
  }

  await interaction.update({
    content: formatJobDetail(job),
    components: [
      buildJobSelectRow(LIST_TARGET_SELECT_ID, jobs, interaction.guild),
    ],
  })
  return true
}

function formatJobDetail(job: BatchJob): string {
  return [
    '📦 バッチジョブ詳細',
    `- name: \`${job.name}\``,
    `- cron: \`${job.cron}\``,
    `- channel: <#${job.channelId}>`,
    `- message: \`${job.message}\``,
  ].join('\n')
}
