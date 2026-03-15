import type { createBotState } from './state'

type BotState = ReturnType<typeof createBotState>

export function resolveChannelDefaultModel(
  state: Pick<BotState, 'getChannelModel'>,
  channelId: string,
): string | undefined {
  return state.getChannelModel(channelId)
}

export function resolveThreadModel(
  state: Pick<
    BotState,
    'getThreadModel' | 'getThreadChannelId' | 'getChannelModel'
  >,
  threadId: string,
): string | undefined {
  const threadModel = state.getThreadModel(threadId)
  if (threadModel) return threadModel

  const channelId = state.getThreadChannelId(threadId)
  if (channelId) {
    return resolveChannelDefaultModel(state, channelId)
  }

  return undefined
}
