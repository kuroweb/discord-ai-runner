import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js'
import type {
  ChannelSelectMenuInteraction,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from 'discord.js'
import type { BatchJob } from '../../../../batch'
import type { CommandDependencies } from '../../types'
import { buildChannelSelectRow, buildJobSelectRow } from './lib/components'
import {
  BATCH_MESSAGE_MAX_LENGTH,
  BATCH_NAME_MAX_LENGTH,
  EDIT_CHANNEL_SELECT_PREFIX,
  EDIT_MODAL_PREFIX,
  EDIT_TARGET_SELECT_ID,
} from './lib/constants'
import {
  normalizeCronInput,
  normalizeMessageInput,
  parseCustomIdWithPrefix,
  validateBatchJobInput,
} from './lib/inputs'

export async function handleBatchEditCommand(
  interaction: ChatInputCommandInteraction,
  { state }: Pick<CommandDependencies, 'state'>,
): Promise<void> {
  const jobs = state.listBatchJobs()
  if (jobs.length === 0) {
    await interaction.reply({
      content: '📦 編集対象ジョブはありません。',
      flags: ['Ephemeral'],
    })
    return
  }
  await interaction.reply({
    content: '編集するジョブを選択してください。',
    components: [
      buildJobSelectRow(EDIT_TARGET_SELECT_ID, jobs, interaction.guild),
    ],
    flags: ['Ephemeral'],
  })
}

export async function handleBatchEditSelect(
  interaction: StringSelectMenuInteraction,
  { state }: Pick<CommandDependencies, 'state'>,
): Promise<boolean> {
  if (interaction.customId !== EDIT_TARGET_SELECT_ID) return false

  const jobId = interaction.values[0]
  if (!jobId) {
    await interaction.update({
      content: '❌ 対象ジョブが選択されていません。',
      components: [],
    })
    return true
  }

  const job = state.getBatchJob(jobId)
  if (!job) {
    await interaction.update({
      content:
        '❌ ジョブが見つかりません。再度 `/batch edit` を実行してください。',
      components: [],
    })
    return true
  }

  await interaction.update({
    content: `編集先チャンネルを選択してください: \`${job.name}\``,
    components: [
      buildChannelSelectRow(`${EDIT_CHANNEL_SELECT_PREFIX}${job.id}`),
    ],
  })
  return true
}

export async function handleBatchEditChannelSelect(
  interaction: ChannelSelectMenuInteraction,
  { state }: Pick<CommandDependencies, 'state'>,
): Promise<boolean> {
  const editJobId = parseCustomIdWithPrefix(
    interaction.customId,
    EDIT_CHANNEL_SELECT_PREFIX,
  )
  if (!editJobId) return false

  const channelId = interaction.values[0]
  if (!channelId) {
    await interaction.update({
      content: '❌ 投稿先チャンネルが選択されていません。',
      components: [],
    })
    return true
  }

  const job = state.getBatchJob(editJobId)
  if (!job) {
    await interaction.update({
      content:
        '❌ ジョブが見つかりません。再度 `/batch edit` を実行してください。',
      components: [],
    })
    return true
  }

  await interaction.showModal(buildEditModal(job, channelId))
  return true
}

export async function handleBatchEditModalSubmit(
  interaction: ModalSubmitInteraction,
  { state, batchRunner }: Pick<CommandDependencies, 'state' | 'batchRunner'>,
): Promise<boolean> {
  if (!interaction.customId.startsWith(EDIT_MODAL_PREFIX)) return false
  const editPayload = parseEditModalCustomId(interaction.customId)
  if (!editPayload) return false

  const current = state.getBatchJob(editPayload.jobId)
  if (!current) {
    await interaction.reply({
      content:
        '❌ ジョブが見つかりません。再度 `/batch edit` を実行してください。',
      flags: ['Ephemeral'],
    })
    return true
  }

  const nameInput = interaction.fields.getTextInputValue('name').trim()
  const cronInput = normalizeCronInput(
    interaction.fields.getTextInputValue('cron'),
  )
  const messageInput = normalizeMessageInput(
    interaction.fields.getTextInputValue('message'),
  )
  const nextName = nameInput || current.name
  const nextCron = cronInput || current.cron
  const nextMessage = messageInput || current.message
  const validationError = validateBatchJobInput({
    name: nextName,
    cronExpr: nextCron,
    message: nextMessage,
  })
  if (validationError) {
    await interaction.reply({ content: validationError, flags: ['Ephemeral'] })
    return true
  }

  const updated = state.updateBatchJob(current.id, {
    name: nextName,
    cron: nextCron,
    channelId: editPayload.channelId,
    message: nextMessage,
  })
  if (!updated) {
    await interaction.reply({
      content: '❌ ジョブ更新に失敗しました。',
      flags: ['Ephemeral'],
    })
    return true
  }

  state.save()
  batchRunner.replace(updated)
  await interaction.reply({
    content: `✅ ジョブを更新しました: \`${updated.name}\``,
    flags: ['Ephemeral'],
  })
  return true
}

function buildEditModal(job: BatchJob, channelId: string): ModalBuilder {
  return new ModalBuilder({
    custom_id: `${EDIT_MODAL_PREFIX}${job.id}:${channelId}`,
    title: `バッチジョブ編集: ${job.id}`,
    components: [
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder({
          custom_id: 'name',
          label: 'job name（空欄で維持）',
        })
          .setPlaceholder(job.name)
          .setRequired(false)
          .setStyle(TextInputStyle.Short)
          .setMaxLength(BATCH_NAME_MAX_LENGTH),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder({
          custom_id: 'cron',
          label: 'cron（空欄で維持）',
        })
          .setPlaceholder(job.cron)
          .setRequired(false)
          .setStyle(TextInputStyle.Short)
          .setMaxLength(100),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder({
          custom_id: 'message',
          label: 'message（空欄で維持）',
        })
          .setPlaceholder(job.message.slice(0, 100))
          .setRequired(false)
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(BATCH_MESSAGE_MAX_LENGTH),
      ),
    ],
  })
}

function parseEditModalCustomId(
  customId: string,
): { jobId: string; channelId: string } | null {
  if (!customId.startsWith(EDIT_MODAL_PREFIX)) return null
  const payload = customId.slice(EDIT_MODAL_PREFIX.length)
  const separatorIdx = payload.indexOf(':')
  if (separatorIdx === -1) return null
  const jobId = payload.slice(0, separatorIdx)
  const channelId = payload.slice(separatorIdx + 1)
  if (!jobId || !channelId) return null
  return { jobId, channelId }
}
