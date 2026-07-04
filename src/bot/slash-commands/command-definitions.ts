import {
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type SlashCommandOptionsOnlyBuilder,
  type SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js'
import {
  handleBatch,
  handleClose,
  handleCwd,
  handleDiffPreviewHtml,
  handleDiffPreviewMarkdown,
  handleForce,
  handleListModelsRemote,
  handleReset,
  handleSession,
  handleSessions,
  handleStatus,
  handleTitle,
} from './commands'
import type { CommandDependencies } from './types'

export type CommandScope = 'managed-thread' | 'channel'

export interface CommandDefinition {
  scope: CommandScope[]
  builder:
    | SlashCommandBuilder
    | SlashCommandOptionsOnlyBuilder
    | SlashCommandSubcommandsOnlyBuilder
  handle: (
    interaction: ChatInputCommandInteraction,
    dependencies: CommandDependencies,
  ) => Promise<void>
}

export const commandDefinitions: CommandDefinition[] = [
  {
    scope: ['managed-thread', 'channel'],
    builder: new SlashCommandBuilder()
      .setName('batch')
      .setDescription('バッチメッセージジョブを管理します')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setContexts(InteractionContextType.Guild)
      .addSubcommand((subcommand) =>
        subcommand.setName('list').setDescription('ジョブ一覧を表示します'),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('create')
          .setDescription('ジョブ作成フローを開始します'),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('edit')
          .setDescription('ジョブ編集フローを開始します'),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('delete')
          .setDescription('ジョブ削除フローを開始します'),
      ),
    handle: handleBatch,
  },
  {
    scope: ['managed-thread', 'channel'],
    builder: new SlashCommandBuilder()
      .setName('sessions')
      .setDescription('現在の作業ディレクトリのセッション一覧を表示します'),
    handle: handleSessions,
  },
  {
    scope: ['managed-thread'],
    builder: new SlashCommandBuilder()
      .setName('session')
      .setDescription('現在のセッションを表示または切り替えます')
      .addStringOption((option) =>
        option
          .setName('id')
          .setDescription(
            '切り替えたい session id。未指定なら現在値を表示します',
          )
          .setRequired(false),
      ),
    handle: handleSession,
  },
  {
    scope: ['managed-thread', 'channel'],
    builder: new SlashCommandBuilder()
      .setName('status')
      .setDescription('現在のスレッドの利用状況を表示します'),
    handle: handleStatus,
  },
  {
    scope: ['managed-thread', 'channel'],
    builder: new SlashCommandBuilder()
      .setName('models')
      .setDescription(
        'リモートのモデル一覧を表示・選択します。通常チャンネルではデフォルトモデルを設定できます',
      ),
    handle: handleListModelsRemote,
  },
  {
    scope: ['managed-thread'],
    builder: new SlashCommandBuilder()
      .setName('force')
      .setDescription(
        'このスレッドのツール実行の承認スキップ（cursor-agent の --force）を切り替えます',
      )
      .addBooleanOption((option) =>
        option
          .setName('enabled')
          .setDescription('true で有効、false で無効。未指定なら現在値を表示')
          .setRequired(false),
      ),
    handle: handleForce,
  },
  {
    scope: ['managed-thread'],
    builder: new SlashCommandBuilder()
      .setName('reset')
      .setDescription('現在のスレッドのセッションをリセットします'),
    handle: handleReset,
  },
  {
    scope: ['managed-thread'],
    builder: new SlashCommandBuilder()
      .setName('close')
      .setDescription('現在のスレッドを閉じます'),
    handle: handleClose,
  },
  {
    scope: ['managed-thread', 'channel'],
    builder: new SlashCommandBuilder()
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
    handle: handleCwd,
  },
  {
    scope: ['managed-thread'],
    builder: new SlashCommandBuilder()
      .setName('sync-thread-name')
      .setDescription('現在の session summary を現在のスレッド名に反映します'),
    handle: handleTitle,
  },
  {
    scope: ['managed-thread'],
    builder: new SlashCommandBuilder()
      .setName('diff-preview-html')
      .setDescription(
        '現在の作業ディレクトリの git diff を HTML 添付で返します',
      )
      .addStringOption((option) =>
        option
          .setName('file')
          .setDescription('特定のファイルだけ見たいときの相対パス')
          .setRequired(false),
      ),
    handle: handleDiffPreviewHtml,
  },
  {
    scope: ['managed-thread'],
    builder: new SlashCommandBuilder()
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
    handle: handleDiffPreviewMarkdown,
  },
]

export const slashCommands = commandDefinitions.map((command) =>
  command.builder.toJSON(),
)

export const commandDefinitionByName = new Map(
  commandDefinitions.map((command) => [command.builder.name, command] as const),
)
