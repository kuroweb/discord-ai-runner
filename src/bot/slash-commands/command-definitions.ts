import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type SlashCommandOptionsOnlyBuilder,
} from 'discord.js'
import {
  handleClose,
  handleCwd,
  handleDiffPreviewHtml,
  handleDiffPreviewMarkdown,
  handleListModelsRemote,
  handleModel,
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
  builder: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder
  handle: (
    interaction: ChatInputCommandInteraction,
    dependencies: CommandDependencies,
  ) => Promise<void>
}

export const commandDefinitions: CommandDefinition[] = [
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
    scope: ['managed-thread', 'channel'],
    builder: new SlashCommandBuilder()
      .setName('model')
      .setDescription(
        '現在のスレッドまたはチャンネルのデフォルトモデルを表示または設定します',
      )
      .addStringOption((option) =>
        option
          .setName('id')
          .setDescription('設定する model id。未指定なら現在値を表示します')
          .setRequired(false),
      ),
    handle: handleModel,
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
