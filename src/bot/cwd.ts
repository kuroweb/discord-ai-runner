import { existsSync, statSync } from 'fs'
import { homedir } from 'os'
import { resolve } from 'path'
import type { createBotState } from './state'

type BotState = ReturnType<typeof createBotState>

export function normalizeDirectoryPath(inputPath: string): string {
  const normalizedInput =
    inputPath === '~'
      ? homedir()
      : inputPath.startsWith('~/')
        ? resolve(homedir(), inputPath.slice(2))
        : inputPath

  return resolve(homedir(), normalizedInput)
}

export function validateDirectoryPath(resolvedPath: string): string | null {
  if (!existsSync(resolvedPath)) {
    return `❌ ディレクトリが見つかりません: \`${resolvedPath}\``
  }

  if (!statSync(resolvedPath).isDirectory()) {
    return `❌ ディレクトリではありません: \`${resolvedPath}\``
  }

  return null
}

export function resolveChannelDefaultCwd(
  state: Pick<BotState, 'getChannelCwd'>,
  channelId: string,
): string {
  return state.getChannelCwd(channelId) ?? process.cwd()
}

export function resolveThreadCwd(
  state: Pick<
    BotState,
    'getThreadCwd' | 'getThreadChannelId' | 'getChannelCwd'
  >,
  threadId: string,
): string {
  const threadCwd = state.getThreadCwd(threadId)
  if (threadCwd) return threadCwd

  const channelId = state.getThreadChannelId(threadId)
  if (channelId) {
    return resolveChannelDefaultCwd(state, channelId)
  }

  return process.cwd()
}
