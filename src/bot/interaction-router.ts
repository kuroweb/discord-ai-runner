import type {
  ButtonInteraction,
  ChannelSelectMenuInteraction,
  ChatInputCommandInteraction,
  Interaction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from 'discord.js'
import {
  handleBatchButton,
  handleBatchChannelSelect,
  handleBatchModalSubmit,
  handleBatchStringSelect,
  handleModelSelect,
  handleRemoteModelPageButton,
  handleSessionSelect as handleSessionSelection,
} from './slash-commands/commands'
import {
  commandDefinitionByName,
  type CommandScope,
} from './slash-commands/command-definitions'
import type { CommandDependencies } from './slash-commands/types'

export const interactionRouter = async (
  interaction: Interaction,
  dependencies: CommandDependencies,
): Promise<boolean> => {
  // スラッシュコマンド
  if (interaction.isChatInputCommand()) {
    await handleSlashCommand(interaction, dependencies)
    return true
  }

  // セッション選択
  if (
    interaction.isStringSelectMenu() &&
    interaction.customId === 'session-select'
  ) {
    await handleSessionSelectMenu(interaction, dependencies)
    return true
  }

  // モデル選択
  if (
    interaction.isStringSelectMenu() &&
    interaction.customId === 'model-select'
  ) {
    await handleModelSelectMenu(interaction, dependencies)
    return true
  }

  if (interaction.isStringSelectMenu()) {
    const handled = await handleBatchJobSelectMenu(interaction, dependencies)
    if (handled) return true
  }

  if (interaction.isChannelSelectMenu()) {
    const handled = await handleBatchChannelSelectMenu(
      interaction,
      dependencies,
    )
    if (handled) return true
  }

  if (interaction.isModalSubmit()) {
    const handled = await handleBatchModal(interaction, dependencies)
    if (handled) return true
  }

  if (interaction.isButton()) {
    const handled = await handleBatchActionButton(interaction, dependencies)
    if (handled) return true
  }

  // キャンセルボタン
  if (interaction.isButton() && interaction.customId === 'cancel') {
    await handleCancelButton(interaction, dependencies)
    return true
  }

  // モデルページングボタン
  if (
    interaction.isButton() &&
    interaction.customId.startsWith('model-remote-page:')
  ) {
    await handleCommandButton(interaction, dependencies)
    return true
  }

  // 承認ボタン
  if (interaction.isButton() && parseApprovalCustomId(interaction.customId)) {
    await handleApprovalButton(interaction, dependencies)
    return true
  }

  return false
}

const handleSlashCommand = async (
  interaction: ChatInputCommandInteraction,
  dependencies: CommandDependencies,
): Promise<void> => {
  const { state } = dependencies
  const isManagedThread = state.isActiveThread(interaction.channelId)
  const command = commandDefinitionByName.get(interaction.commandName)
  const currentScope: CommandScope = isManagedThread
    ? 'managed-thread'
    : 'channel'

  if (!command) {
    throw new Error(`unknown slash command: ${interaction.commandName}`)
  }

  if (!command.scope.includes(currentScope)) {
    await interaction.reply({
      content:
        'このコマンドは bot が管理しているスレッド内で実行してください。',
      flags: ['Ephemeral'],
    })
    return
  }

  return command.handle(interaction, dependencies)
}

const handleSessionSelectMenu = async (
  interaction: StringSelectMenuInteraction,
  dependencies: CommandDependencies,
): Promise<void> => {
  return handleSessionSelection(interaction, dependencies)
}

const handleModelSelectMenu = async (
  interaction: StringSelectMenuInteraction,
  dependencies: CommandDependencies,
): Promise<void> => {
  return handleModelSelect(interaction, dependencies)
}

const handleBatchJobSelectMenu = async (
  interaction: StringSelectMenuInteraction,
  dependencies: CommandDependencies,
): Promise<boolean> => {
  return handleBatchStringSelect(interaction, dependencies)
}

const handleBatchChannelSelectMenu = async (
  interaction: ChannelSelectMenuInteraction,
  dependencies: CommandDependencies,
): Promise<boolean> => {
  return handleBatchChannelSelect(interaction, dependencies)
}

const handleBatchModal = async (
  interaction: ModalSubmitInteraction,
  dependencies: CommandDependencies,
): Promise<boolean> => {
  return handleBatchModalSubmit(interaction, dependencies)
}

const handleBatchActionButton = async (
  interaction: ButtonInteraction,
  dependencies: CommandDependencies,
): Promise<boolean> => {
  return handleBatchButton(interaction, dependencies)
}

const handleCommandButton = async (
  interaction: ButtonInteraction,
  dependencies: CommandDependencies,
): Promise<boolean> => {
  return handleRemoteModelPageButton(interaction, dependencies)
}

const handleCancelButton = async (
  interaction: ButtonInteraction,
  dependencies: CommandDependencies,
): Promise<boolean> => {
  if (interaction.customId !== 'cancel') return false
  dependencies.scheduler.abort(interaction.channelId)
  await interaction.update({ components: [] })
  return true
}

const handleApprovalButton = async (
  interaction: ButtonInteraction,
  dependencies: CommandDependencies,
): Promise<boolean> => {
  const parsed = parseApprovalCustomId(interaction.customId)
  if (!parsed) return false
  const { decision, requestId } = parsed

  const resolved = dependencies.approvalManager.resolveApproval(
    requestId,
    decision,
  )
  if (!resolved) {
    await interaction.reply({
      content: 'この承認リクエストは期限切れです。',
      flags: ['Ephemeral'],
    })
    return true
  }

  const messages: Record<typeof decision, string> = {
    approve: '✅ 承認しました',
    deny: '❌ 拒否しました',
    'approve-all': '⚡ このスレッドの自動承認を有効化しました',
  }

  await interaction.update({
    content: messages[decision],
    embeds: [],
    components: [],
  })
  return true
}

const parseApprovalCustomId = (
  customId: string,
): {
  decision: 'approve' | 'deny' | 'approve-all'
  requestId: string
} | null => {
  const idx = customId.indexOf(':')
  const action = idx === -1 ? customId : customId.slice(0, idx)
  const requestId = idx === -1 ? '' : customId.slice(idx + 1)
  if (!requestId) return null

  if (action === 'approve' || action === 'deny' || action === 'approve-all') {
    return { decision: action, requestId }
  }

  return null
}
