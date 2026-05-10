import {
  ActionRowBuilder,
  ChannelSelectMenuInteraction,
  ChatInputCommandInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js'
import type { CommandDependencies } from '../../types'
import { buildChannelSelectRow } from './lib/components'
import {
  BATCH_MESSAGE_MAX_LENGTH,
  BATCH_NAME_MAX_LENGTH,
  CREATE_CHANNEL_SELECT_ID,
  CREATE_MODAL_PREFIX,
} from './lib/constants'
import {
  normalizeCronInput,
  normalizeMessageInput,
  parseCustomIdWithPrefix,
  validateBatchJobInput,
} from './lib/inputs'

export async function handleBatchCreateCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.reply({
    content: '投稿先チャンネルを選択してください。',
    components: [buildChannelSelectRow(CREATE_CHANNEL_SELECT_ID)],
    flags: ['Ephemeral'],
  })
}

export async function handleBatchCreateChannelSelect(
  interaction: ChannelSelectMenuInteraction,
): Promise<boolean> {
  if (interaction.customId !== CREATE_CHANNEL_SELECT_ID) return false

  const channelId = interaction.values[0]
  if (!channelId) {
    await interaction.update({
      content: '❌ 投稿先チャンネルが選択されていません。',
      components: [],
    })
    return true
  }

  await interaction.showModal(buildCreateModal(channelId))
  return true
}

export async function handleBatchCreateModalSubmit(
  interaction: ModalSubmitInteraction,
  { state, batchRunner }: Pick<CommandDependencies, 'state' | 'batchRunner'>,
): Promise<boolean> {
  const createChannelId = parseCustomIdWithPrefix(
    interaction.customId,
    CREATE_MODAL_PREFIX,
  )
  if (!createChannelId) return false

  const name = interaction.fields.getTextInputValue('name').trim()
  const cronExpr = normalizeCronInput(
    interaction.fields.getTextInputValue('cron'),
  )
  const message = normalizeMessageInput(
    interaction.fields.getTextInputValue('message'),
  )
  const validationError = validateBatchJobInput({ name, cronExpr, message })
  if (validationError) {
    await interaction.reply({ content: validationError, flags: ['Ephemeral'] })
    return true
  }

  const job = state.createBatchJob({
    name,
    cron: cronExpr,
    channelId: createChannelId,
    message,
  })
  state.save()
  batchRunner.add(job)
  await interaction.reply({
    content: `✅ ジョブを作成しました: \`${job.name}\``,
    flags: ['Ephemeral'],
  })
  return true
}

function buildCreateModal(channelId: string): ModalBuilder {
  return new ModalBuilder({
    custom_id: `${CREATE_MODAL_PREFIX}${channelId}`,
    title: 'バッチジョブ作成',
    components: [
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder({
          custom_id: 'name',
          label: 'job name',
        })
          .setPlaceholder('job-name')
          .setRequired(true)
          .setStyle(TextInputStyle.Short)
          .setMaxLength(BATCH_NAME_MAX_LENGTH),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder({
          custom_id: 'cron',
          label: 'cron',
        })
          .setPlaceholder('*/30 * * * *')
          .setRequired(true)
          .setStyle(TextInputStyle.Short)
          .setMaxLength(100),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder({
          custom_id: 'message',
          label: 'message',
        })
          .setPlaceholder('実行するメッセージを入力')
          .setRequired(true)
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(BATCH_MESSAGE_MAX_LENGTH),
      ),
    ],
  })
}
