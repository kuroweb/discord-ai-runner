import {
  REST,
  Routes,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client,
} from 'discord.js'
import {
  getThreadCwd,
  getThreadStatus,
  resetThreadSession,
  setThreadCwd,
} from './thread-commands'
import type { createApprovalManager } from './approval-manager'
import type { createBotState } from './state'
import type { createThreadTaskManager } from './thread-task-manager'

const slashCommands = [
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('現在のスレッドの利用状況を表示します'),
  new SlashCommandBuilder()
    .setName('reset')
    .setDescription('現在のスレッドのセッションをリセットします'),
  new SlashCommandBuilder()
    .setName('cwd')
    .setDescription(
      '現在のスレッドに紐づく作業ディレクトリを表示または設定します',
    )
    .addStringOption((option) =>
      option
        .setName('path')
        .setDescription(
          '設定したいディレクトリパス。未指定なら現在値を表示します',
        )
        .setRequired(false),
    ),
].map((command) => command.toJSON())

interface SlashCommandDependencies {
  state: ReturnType<typeof createBotState>
  taskManager: ReturnType<typeof createThreadTaskManager>
  approvalManager: ReturnType<typeof createApprovalManager>
}

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
  dependencies: SlashCommandDependencies,
): Promise<void> {
  const { state, taskManager, approvalManager } = dependencies
  const channelId = interaction.channelId

  if (!state.isActiveThread(channelId)) {
    await interaction.reply({
      content:
        'このコマンドは bot が管理しているスレッド内で実行してください。',
      flags: ['Ephemeral'],
    })
    return
  }

  if (interaction.commandName === 'status') {
    await interaction.reply(getThreadStatus(channelId, { state }))
    return
  }

  if (interaction.commandName === 'reset') {
    await interaction.reply(
      resetThreadSession(channelId, { state, taskManager, approvalManager }),
    )
    return
  }

  if (interaction.commandName === 'cwd') {
    const path = interaction.options.getString('path')
    if (!path) {
      await interaction.reply(
        `📁 現在の cwd: \`${getThreadCwd(channelId, { state })}\``,
      )
      return
    }

    await interaction.reply(setThreadCwd(channelId, path, { state }))
  }
}
