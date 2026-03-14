import type { ChatInputCommandInteraction } from 'discord.js'
import {
  normalizeDirectoryPath,
  resolveChannelDefaultCwd,
  resolveThreadCwd,
  validateDirectoryPath,
} from '../cwd'
import type { CommandDependencies } from './types'

export async function handleCwd(
  interaction: ChatInputCommandInteraction,
  { state, scheduler }: CommandDependencies,
): Promise<void> {
  const channelId = interaction.channelId
  const isManagedThread = state.isActiveThread(channelId)
  const isThread = interaction.channel?.isThread() ?? false
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
      ? `📁 現在の作業ディレクトリ: \`${resolveThreadCwd(state, channelId)}\``
      : `📁 このチャンネルのデフォルト作業ディレクトリ: \`${resolveChannelDefaultCwd(state, channelId)}\``
    await interaction.reply(content)
    return
  }

  const resolvedPath = normalizeDirectoryPath(path)
  const validationError = validateDirectoryPath(resolvedPath)
  if (validationError) {
    await interaction.reply(validationError)
    return
  }

  if (isManagedThread) {
    if (resolveThreadCwd(state, channelId) === resolvedPath) {
      await interaction.reply(
        `📁 このスレッドの作業ディレクトリはすでに \`${resolvedPath}\` です。`,
      )
      return
    }
    scheduler.abort(channelId)
    state.clearSession(channelId)
    state.setThreadCwd(channelId, resolvedPath)
    state.save()
    await interaction.reply(
      `📁 このスレッドの作業ディレクトリを \`${resolvedPath}\` に設定しました。変更に合わせて、このスレッドのセッションもリセットしました。`,
    )
  } else {
    if (resolveChannelDefaultCwd(state, channelId) === resolvedPath) {
      await interaction.reply(
        `📁 このチャンネルのデフォルト作業ディレクトリはすでに \`${resolvedPath}\` です。`,
      )
      return
    }
    state.setChannelCwd(channelId, resolvedPath)
    state.save()
    await interaction.reply(
      `📁 このチャンネルのデフォルト作業ディレクトリを \`${resolvedPath}\` に設定しました。新しく作成されるスレッドで自動的に使われます。`,
    )
  }
}
