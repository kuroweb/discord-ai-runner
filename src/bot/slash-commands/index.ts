import {
  REST,
  Routes,
  SlashCommandBuilder,
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
import { handleReset } from './reset'
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
  const guildId = process.env.DISCORD_GUILD_ID
  const route = guildId
    ? Routes.applicationGuildCommands(applicationId, guildId)
    : Routes.applicationCommands(applicationId)

  await rest.put(route, { body: slashCommands })
  console.log(
    guildId
      ? `✅ guild slash commands を登録しました (${guildId})`
      : '✅ global slash commands を登録しました',
  )
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
  return _handleSessionSelect(interaction, dependencies)
}
