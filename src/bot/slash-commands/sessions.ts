import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js'
import type { AiAdapter } from '../../adapters'
import { resolveThreadCwd } from '../cwd'
import type { CommandDependencies } from './types'

function formatSessionList(
  cwd: string,
  currentSessionId: string | undefined,
  sessions: Awaited<ReturnType<NonNullable<AiAdapter['listSessions']>>>,
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

export async function handleSessions(
  interaction: ChatInputCommandInteraction,
  { adapter, state }: CommandDependencies,
): Promise<void> {
  if (!adapter.listSessions) {
    await interaction.reply('❌ この AI adapter は `/sessions` に未対応です。')
    return
  }

  await interaction.deferReply()

  try {
    const cwd = resolveThreadCwd(state, interaction.channelId)
    const sessions = await adapter.listSessions(cwd, { limit: 25 })
    const currentSessionId = state.getSession(interaction.channelId)
    const content = formatSessionList(cwd, currentSessionId, sessions)

    if (sessions.length === 0) {
      await interaction.editReply(content)
      return
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId('session-select')
      .setPlaceholder('セッションを選択して切り替え')
      .addOptions(
        sessions.map((session) => {
          const label = (session.summary.trim() || session.id).slice(0, 100)
          const descParts: string[] = []
          if (session.gitBranch) descParts.push(session.gitBranch)
          if (typeof session.lastModified === 'number') {
            descParts.push(
              new Date(session.lastModified).toLocaleString('ja-JP'),
            )
          }
          const option = new StringSelectMenuOptionBuilder()
            .setLabel(label)
            .setValue(session.id)
            .setDefault(session.id === currentSessionId)
          if (descParts.length > 0) {
            option.setDescription(descParts.join(' · ').slice(0, 100))
          }
          return option
        }),
      )

    const row =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)
    await interaction.editReply({
      content: `📚 セッション一覧 (cwd: \`${cwd}\`)`,
      components: [row],
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'セッション一覧の取得に失敗しました。'
    await interaction.editReply(`❌ ${message}`)
  }
}
