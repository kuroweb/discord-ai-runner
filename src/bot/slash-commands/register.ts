import {
  REST,
  Routes,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type StringSelectMenuInteraction,
} from 'discord.js'
import {
  handleModelSelect,
  handleRemoteModelPageButton,
  handleSessionSelect as handleSessionSelection,
} from './commands'
import {
  commandDefinitionByName,
  slashCommands,
  type CommandScope,
} from './command-definitions'
import type { CommandDependencies } from './types'

export async function registerSlashCommands(
  client: Client,
  token: string,
): Promise<void> {
  const applicationId = client.application?.id
  if (!applicationId) {
    throw new Error('application id を取得できませんでした')
  }

  const rest = new REST({ version: '10' }).setToken(token)
  const route = Routes.applicationCommands(applicationId)

  await rest.put(route, { body: slashCommands })
  console.log('✅ global slash commands を登録しました')
}

export async function handleSlashCommand(
  interaction: ChatInputCommandInteraction,
  dependencies: CommandDependencies,
): Promise<void> {
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

export async function handleSessionSelect(
  interaction: StringSelectMenuInteraction,
  dependencies: CommandDependencies,
): Promise<void> {
  if (interaction.customId === 'model-select') {
    return handleModelSelect(interaction, dependencies)
  }

  return handleSessionSelection(interaction, dependencies)
}

export async function handleCommandButton(
  interaction: ButtonInteraction,
  dependencies: CommandDependencies,
): Promise<boolean> {
  return handleRemoteModelPageButton(interaction, dependencies)
}
