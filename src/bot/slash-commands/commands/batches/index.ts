import type {
  ButtonInteraction,
  ChannelSelectMenuInteraction,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from 'discord.js'
import type { CommandDependencies } from '../../types'
import {
  handleBatchCreateChannelSelect,
  handleBatchCreateCommand,
  handleBatchCreateModalSubmit,
} from './create'
import {
  handleBatchDeleteButton,
  handleBatchDeleteCommand,
  handleBatchDeleteSelect,
} from './delete'
import {
  handleBatchEditChannelSelect,
  handleBatchEditCommand,
  handleBatchEditModalSubmit,
  handleBatchEditSelect,
} from './edit'
import { handleBatchListCommand, handleBatchListSelect } from './list'

export async function handleBatch(
  interaction: ChatInputCommandInteraction,
  dependencies: CommandDependencies,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand()
  if (subcommand === 'list')
    return handleBatchListCommand(interaction, dependencies)
  if (subcommand === 'create') return handleBatchCreateCommand(interaction)
  if (subcommand === 'edit')
    return handleBatchEditCommand(interaction, dependencies)
  return handleBatchDeleteCommand(interaction, dependencies)
}

export async function handleBatchStringSelect(
  interaction: StringSelectMenuInteraction,
  dependencies: CommandDependencies,
): Promise<boolean> {
  if (await handleBatchListSelect(interaction, dependencies)) return true
  if (await handleBatchEditSelect(interaction, dependencies)) return true
  if (await handleBatchDeleteSelect(interaction, dependencies)) return true
  return false
}

export async function handleBatchChannelSelect(
  interaction: ChannelSelectMenuInteraction,
  dependencies: CommandDependencies,
): Promise<boolean> {
  if (await handleBatchCreateChannelSelect(interaction)) return true
  if (await handleBatchEditChannelSelect(interaction, dependencies)) return true
  return false
}

export async function handleBatchModalSubmit(
  interaction: ModalSubmitInteraction,
  dependencies: CommandDependencies,
): Promise<boolean> {
  if (await handleBatchCreateModalSubmit(interaction, dependencies)) return true
  if (await handleBatchEditModalSubmit(interaction, dependencies)) return true
  return false
}

export async function handleBatchButton(
  interaction: ButtonInteraction,
  dependencies: CommandDependencies,
): Promise<boolean> {
  return handleBatchDeleteButton(interaction, dependencies)
}
