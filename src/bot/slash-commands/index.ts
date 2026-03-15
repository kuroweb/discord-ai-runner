import {
  REST,
  Routes,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type StringSelectMenuInteraction,
} from 'discord.js'
import { handleClose } from './close'
import { handleCwd } from './cwd'
import {
  handleDiffPreviewHtml,
  handleDiffPreviewMarkdown,
} from './diff-preview'
import { handleTitle } from './sync-thread-name'
import { handleReset } from './reset'
import {
  handleModel,
  handleRemoteModelPageButton,
  handleListModelsRemote,
  handleModelSelect,
} from './models'
import {
  handleSession,
  handleSessionSelect as _handleSessionSelect,
} from './session'
import { handleSessions } from './sessions'
import { handleStatus } from './status'
import type { CommandDependencies } from './types'

export type { CommandDependencies }

const COMMANDS_ALLOWED_OUTSIDE_MANAGED_THREAD = new Set(['cwd', 'sessions'])

const slashCommands = [
  new SlashCommandBuilder()
    .setName('sessions')
    .setDescription('現在の作業ディレクトリのセッション一覧を表示します'),
  new SlashCommandBuilder()
    .setName('session')
    .setDescription('現在のセッションを表示または切り替えます')
    .addStringOption((option) =>
      option
        .setName('id')
        .setDescription('切り替えたい session id。未指定なら現在値を表示します')
        .setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('現在のスレッドの利用状況を表示します'),
  new SlashCommandBuilder()
    .setName('models')
    .setDescription('リモートのモデル一覧を表示・選択します'),
  new SlashCommandBuilder()
    .setName('model')
    .setDescription('モデル ID を指定して現在のスレッドに設定します')
    .addStringOption((option) =>
      option
        .setName('id')
        .setDescription('設定する model id')
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName('reset')
    .setDescription('現在のスレッドのセッションをリセットします'),
  new SlashCommandBuilder()
    .setName('close')
    .setDescription('現在のスレッドを閉じます'),
  new SlashCommandBuilder()
    .setName('cwd')
    .setDescription(
      '現在のスレッドまたはチャンネルの作業ディレクトリを表示または設定します',
    )
    .addStringOption((option) =>
      option
        .setName('path')
        .setDescription(
          '設定したいディレクトリパス。未指定なら現在値を表示します',
        )
        .setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName('sync-thread-name')
    .setDescription('現在の session summary を現在のスレッド名に反映します'),
  new SlashCommandBuilder()
    .setName('diff-preview-html')
    .setDescription('現在の作業ディレクトリの git diff を HTML 添付で返します')
    .addStringOption((option) =>
      option
        .setName('file')
        .setDescription('特定のファイルだけ見たいときの相対パス')
        .setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName('diff-preview-markdown')
    .setDescription(
      '現在の作業ディレクトリの git diff を Markdown コードブロックで返します',
    )
    .addStringOption((option) =>
      option
        .setName('file')
        .setDescription('特定のファイルだけ見たいときの相対パス')
        .setRequired(false),
    ),
].map((command) => command.toJSON())

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

  if (
    !isManagedThread &&
    !COMMANDS_ALLOWED_OUTSIDE_MANAGED_THREAD.has(interaction.commandName)
  ) {
    await interaction.reply({
      content:
        'このコマンドは bot が管理しているスレッド内で実行してください。',
      flags: ['Ephemeral'],
    })
    return
  }

  switch (interaction.commandName) {
    case 'status':
      return handleStatus(interaction, dependencies)
    case 'models':
      return handleListModelsRemote(interaction, dependencies)
    case 'model':
      return handleModel(interaction, dependencies)
    case 'session':
      return handleSession(interaction, dependencies)
    case 'sessions':
      return handleSessions(interaction, dependencies)
    case 'reset':
      return handleReset(interaction, dependencies)
    case 'close':
      return handleClose(interaction, dependencies)
    case 'cwd':
      return handleCwd(interaction, dependencies)
    case 'sync-thread-name':
      return handleTitle(interaction, dependencies)
    case 'diff-preview-html':
      return handleDiffPreviewHtml(interaction, dependencies)
    case 'diff-preview-markdown':
      return handleDiffPreviewMarkdown(interaction, dependencies)
  }
}

export async function handleSessionSelect(
  interaction: StringSelectMenuInteraction,
  dependencies: CommandDependencies,
): Promise<void> {
  if (interaction.customId === 'model-select') {
    return handleModelSelect(interaction, dependencies)
  }

  return _handleSessionSelect(interaction, dependencies)
}

export async function handleCommandButton(
  interaction: ButtonInteraction,
  dependencies: CommandDependencies,
): Promise<boolean> {
  return handleRemoteModelPageButton(interaction, dependencies)
}
