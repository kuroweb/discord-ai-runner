import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  StringSelectMenuInteraction,
} from 'discord.js'
import type { CommandDependencies } from '../../types'
import { buildJobSelectRow } from './lib/components'
import {
  DELETE_CANCEL_PREFIX,
  DELETE_CONFIRM_PREFIX,
  DELETE_TARGET_SELECT_ID,
} from './lib/constants'
import { parseCustomIdWithPrefix } from './lib/inputs'

export async function handleBatchDeleteCommand(
  interaction: ChatInputCommandInteraction,
  { state }: Pick<CommandDependencies, 'state'>,
): Promise<void> {
  const jobs = state.listBatchJobs()
  if (jobs.length === 0) {
    await interaction.reply({
      content: '📦 削除対象ジョブはありません。',
      flags: ['Ephemeral'],
    })
    return
  }
  await interaction.reply({
    content: '削除するジョブを選択してください。',
    components: [
      buildJobSelectRow(DELETE_TARGET_SELECT_ID, jobs, interaction.guild),
    ],
    flags: ['Ephemeral'],
  })
}

export async function handleBatchDeleteSelect(
  interaction: StringSelectMenuInteraction,
  { state }: Pick<CommandDependencies, 'state'>,
): Promise<boolean> {
  if (interaction.customId !== DELETE_TARGET_SELECT_ID) return false

  const jobId = interaction.values[0]
  if (!jobId) {
    await interaction.update({
      content: '❌ 対象ジョブが選択されていません。',
      components: [],
    })
    return true
  }

  const job = state.getBatchJob(jobId)
  await interaction.update({
    content: job
      ? `🗑️ ジョブ \`${job.name}\` を削除しますか？`
      : `🗑️ ジョブ \`${jobId}\` を削除しますか？`,
    components: [buildDeleteConfirmRow(jobId)],
  })
  return true
}

export async function handleBatchDeleteButton(
  interaction: ButtonInteraction,
  { state, batchRunner }: Pick<CommandDependencies, 'state' | 'batchRunner'>,
): Promise<boolean> {
  const deleteJobId = parseCustomIdWithPrefix(
    interaction.customId,
    DELETE_CONFIRM_PREFIX,
  )
  if (deleteJobId) {
    const job = state.getBatchJob(deleteJobId)
    const deleted = state.deleteBatchJob(deleteJobId)
    if (!deleted) {
      await interaction.update({
        content:
          '❌ ジョブが見つかりません。すでに削除済みの可能性があります。',
        components: [],
      })
      return true
    }
    state.save()
    batchRunner.remove(deleteJobId)
    await interaction.update({
      content: `🗑️ ジョブを削除しました: \`${job?.name ?? deleteJobId}\``,
      components: [],
    })
    return true
  }

  const canceledJobId = parseCustomIdWithPrefix(
    interaction.customId,
    DELETE_CANCEL_PREFIX,
  )
  if (!canceledJobId) return false

  await interaction.update({
    content: '削除をキャンセルしました',
    components: [],
  })
  return true
}

function buildDeleteConfirmRow(jobId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${DELETE_CONFIRM_PREFIX}${jobId}`)
      .setLabel('削除する')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`${DELETE_CANCEL_PREFIX}${jobId}`)
      .setLabel('キャンセル')
      .setStyle(ButtonStyle.Secondary),
  )
}
