import {
  REST,
  Routes,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client,
} from 'discord.js'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import type { AiAdapter } from '../adapters'
import {
  DISCORD_MAX_LENGTH,
  splitMarkdownCodeBlocksForDiscord,
} from './messages'
import {
  getChannelDefaultCwd,
  getThreadCwd,
  getThreadStatus,
  resetThreadSession,
  setChannelDefaultCwd,
  setThreadCwd,
} from './thread-commands'
import type { createApprovalManager } from './approval-manager'
import type { createBotState } from './state'
import type { createThreadTaskManager } from './thread-task-manager'

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

interface SlashCommandDependencies {
  adapter: AiAdapter
  state: ReturnType<typeof createBotState>
  taskManager: ReturnType<typeof createThreadTaskManager>
  approvalManager: ReturnType<typeof createApprovalManager>
}

function formatSessionList(
  cwd: string,
  currentSessionId: string | undefined,
  sessions: Awaited<
    ReturnType<NonNullable<AiAdapter['listSessions']>>
  >,
): string {
  const lines = [`cwd: ${cwd}`]

  if (sessions.length === 0) {
    lines.push('(no sessions)')
    return `📚 セッション一覧\n\`\`\`text\n${lines.join('\n')}\n\`\`\``
  }

  for (const session of sessions) {
    const marker = session.id === currentSessionId ? '*' : ' '
    const summary = session.summary.trim() || '（タイトルなし）'
    const branch = session.gitBranch ? ` · ${session.gitBranch}` : ''
    const updated =
      typeof session.lastModified === 'number'
        ? ` · ${new Date(session.lastModified).toLocaleString('ja-JP')}`
        : ''
    lines.push(`${marker} ${session.id} ${summary}${branch}${updated}`)
  }

  return `📚 セッション一覧\n\`\`\`text\n${lines.join('\n')}\n\`\`\``
}

async function runGitDiffHtmlCommand(
  cwd: string,
  options: {
    file?: string | null
  },
): Promise<{ outputPath: string; tempDir: string }> {
  const tempDir = await mkdtemp(
    resolve(tmpdir(), 'discord-ai-runner-git-diff-'),
  )
  const outputPath = resolve(tempDir, 'git-diff.html')
  const toolPath = resolve(process.cwd(), 'agent-tools/bin/diff-preview-html')
  const toolArgs = ['--output', outputPath, '--repo', cwd]

  if (options.file?.trim()) {
    toolArgs.push('--', options.file.trim())
  }

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const proc = spawn(toolPath, toolArgs, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stderr = ''

    proc.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString()
    })

    proc.on('error', rejectPromise)
    proc.on('close', (code) => {
      if (code === 0) {
        resolvePromise()
        return
      }

      rejectPromise(
        new Error(stderr.trim() || 'プレビューの生成に失敗しました。'),
      )
    })
  })

  return { outputPath, tempDir }
}

async function runGitDiffMarkdownCommand(
  cwd: string,
  options: { file?: string | null },
): Promise<string> {
  const toolPath = resolve(process.cwd(), 'agent-tools/bin/diff-preview-markdown')
  const toolArgs = ['--repo', cwd]
  if (options.file?.trim()) {
    toolArgs.push('--', options.file.trim())
  }

  const result = spawnSync(toolPath, toolArgs, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  })

  if (result.status !== 0) {
    throw new Error(
      result.stderr?.trim() || 'プレビューの生成に失敗しました。',
    )
  }
  return result.stdout ?? ''
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
  const { adapter, state, taskManager, approvalManager } = dependencies
  const channelId = interaction.channelId
  const isManagedThread = state.isActiveThread(channelId)
  const isThread = interaction.channel?.isThread() ?? false

  if (
    !isManagedThread &&
    interaction.commandName !== 'cwd' &&
    interaction.commandName !== 'sessions' &&
    interaction.commandName !== 'diff-preview-html' &&
    interaction.commandName !== 'diff-preview-markdown'
  ) {
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

  if (interaction.commandName === 'session') {
    const sessionId = interaction.options.getString('id')?.trim()
    if (!sessionId) {
      const currentSessionId = state.getSession(channelId)
      await interaction.reply(
        currentSessionId
          ? `📚 現在のセッション: \`${currentSessionId}\``
          : '📚 現在のセッションはありません。',
      )
      return
    }

    taskManager.nextRevision(channelId)
    state.clearSession(channelId)
    state.setSession(channelId, sessionId)
    approvalManager.clearAutoApprove(channelId)
    state.save()
    await interaction.reply(`📚 セッションを \`${sessionId}\` に切り替えました。`)
    return
  }

  if (interaction.commandName === 'sessions') {
    if (!adapter.listSessions) {
      await interaction.reply('❌ この AI adapter は `/sessions` に未対応です。')
      return
    }

    await interaction.deferReply()

    try {
      const cwd = getThreadCwd(channelId, { state })
      const sessions = await adapter.listSessions(cwd, { limit: 10 })
      const content = formatSessionList(cwd, state.getSession(channelId), sessions)
      await interaction.editReply(content)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'セッション一覧の取得に失敗しました。'
      await interaction.editReply(`❌ ${message}`)
    }
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
    if (!isManagedThread && isThread) {
      await interaction.reply({
        content:
          'このスレッドは bot の管理対象ではありません。通常チャンネルで実行するとデフォルト作業ディレクトリを設定できます。',
        flags: ['Ephemeral'],
      })
      return
    }

    if (!path) {
      const content = isManagedThread
        ? `📁 現在の作業ディレクトリ: \`${getThreadCwd(channelId, { state })}\``
        : `📁 このチャンネルのデフォルト作業ディレクトリ: \`${getChannelDefaultCwd(channelId, { state })}\``
      await interaction.reply(content)
      return
    }

    const content = isManagedThread
      ? setThreadCwd(channelId, path, { state, taskManager })
      : setChannelDefaultCwd(channelId, path, { state })
    await interaction.reply(content)
    return
  }

  if (interaction.commandName === 'diff-preview-html') {
    if (!isManagedThread) {
      await interaction.reply({
        content:
          'このコマンドは bot が管理しているスレッド内で実行してください。',
        flags: ['Ephemeral'],
      })
      return
    }

    await interaction.deferReply()

    let tempDir: string | null = null
    try {
      const cwd = getThreadCwd(channelId, { state })
      const file = interaction.options.getString('file')
      const result = await runGitDiffHtmlCommand(cwd, { file })
      tempDir = result.tempDir

      await interaction.editReply({
        content: file?.trim()
          ? `📎 \`${file.trim()}\` の git diff を HTML にしました。`
          : `📎 \`${cwd}\` の git diff を HTML にしました。`,
        files: [result.outputPath],
      })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'プレビューの生成に失敗しました。'
      await interaction.editReply(`❌ ${message}`)
    } finally {
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true })
      }
    }
  }

  if (interaction.commandName === 'diff-preview-markdown') {
    if (!isManagedThread) {
      await interaction.reply({
        content:
          'このコマンドは bot が管理しているスレッド内で実行してください。',
        flags: ['Ephemeral'],
      })
      return
    }

    await interaction.deferReply()

    try {
      const cwd = getThreadCwd(channelId, { state })
      const file = interaction.options.getString('file')
      const markdown = await runGitDiffMarkdownCommand(cwd, { file })
      const header = file?.trim()
        ? `📋 \`${file.trim()}\` の git diff`
        : `📋 \`${cwd}\` の git diff`
      const chunks = splitMarkdownCodeBlocksForDiscord(
        markdown,
        DISCORD_MAX_LENGTH,
        header,
      )

      await interaction.editReply({ content: chunks[0] })

      for (let i = 1; i < chunks.length; i += 1) {
        await interaction.followUp({ content: chunks[i] })
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'プレビューの生成に失敗しました。'
      await interaction.editReply(`❌ ${message}`)
    }
  }
}
