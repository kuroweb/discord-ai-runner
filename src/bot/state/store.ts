import { readFileSync, writeFileSync } from 'fs'
import type { AiResult } from '../../adapters'

interface PersistedThread {
  sessionId?: string
  cwd?: string
  channelId?: string
  model?: string
}

interface PersistedState {
  threads: Record<string, PersistedThread>
  channels: Record<string, { cwd?: string; model?: string }>
}

export const createBotState = (stateFile: string) => {
  const activeThreads = new Set<string>()
  const sessions = new Map<string, string>()
  const threadCwds = new Map<string, string>()
  const threadModels = new Map<string, string>()
  const channelCwds = new Map<string, string>()
  const channelModels = new Map<string, string>()
  const threadChannelIds = new Map<string, string>()
  const threadUsage = new Map<string, AiResult>()

  const load = (): void => {
    try {
      const data = readFileSync(stateFile, 'utf-8')
      const state: PersistedState = JSON.parse(data)
      for (const [threadId, thread] of Object.entries(state.threads ?? {})) {
        activeThreads.add(threadId)
        if (thread.sessionId) sessions.set(threadId, thread.sessionId)
        if (thread.cwd) threadCwds.set(threadId, thread.cwd)
        if (thread.channelId) threadChannelIds.set(threadId, thread.channelId)
        if (thread.model) threadModels.set(threadId, thread.model)
      }
      for (const [channelId, channel] of Object.entries(state.channels ?? {})) {
        if (channel.cwd) channelCwds.set(channelId, channel.cwd)
        if (channel.model) channelModels.set(channelId, channel.model)
      }
      console.log(
        `[state] 復元: threads=${activeThreads.size}, sessions=${sessions.size}`,
      )
    } catch {
      // ファイルが存在しない場合は無視
    }
  }

  const save = (): void => {
    const threads: Record<string, PersistedThread> = {}
    for (const threadId of activeThreads) {
      threads[threadId] = {
        sessionId: sessions.get(threadId),
        cwd: threadCwds.get(threadId),
        channelId: threadChannelIds.get(threadId),
        model: threadModels.get(threadId),
      }
    }
    const channels: Record<string, { cwd?: string; model?: string }> = {}
    for (const [channelId, cwd] of channelCwds) {
      channels[channelId] = { ...channels[channelId], cwd }
    }
    for (const [channelId, model] of channelModels) {
      channels[channelId] = { ...channels[channelId], model }
    }
    const state: PersistedState = { threads, channels }
    writeFileSync(stateFile, JSON.stringify(state, null, 2))
  }

  const isActiveThread = (threadId: string): boolean => {
    return activeThreads.has(threadId)
  }

  const activateThread = (threadId: string, channelId?: string): void => {
    activeThreads.add(threadId)
    if (channelId) {
      threadChannelIds.set(threadId, channelId)
    }
  }

  const getSession = (threadId: string): string | undefined => {
    return sessions.get(threadId)
  }

  const setSession = (threadId: string, sessionId: string): void => {
    sessions.set(threadId, sessionId)
  }

  const clearSession = (threadId: string): void => {
    sessions.delete(threadId)
    threadUsage.delete(threadId)
  }

  const getThreadCwd = (threadId: string): string | undefined => {
    return threadCwds.get(threadId)
  }

  const getThreadModel = (threadId: string): string | undefined => {
    return threadModels.get(threadId)
  }

  const setThreadCwd = (threadId: string, cwd: string): void => {
    threadCwds.set(threadId, cwd)
  }

  const clearThreadCwd = (threadId: string): void => {
    threadCwds.delete(threadId)
  }

  const setThreadModel = (threadId: string, model: string): void => {
    threadModels.set(threadId, model)
  }

  const clearThreadModel = (threadId: string): void => {
    threadModels.delete(threadId)
  }

  const getChannelCwd = (channelId: string): string | undefined => {
    return channelCwds.get(channelId)
  }

  const setChannelCwd = (channelId: string, cwd: string): void => {
    channelCwds.set(channelId, cwd)
  }

  const clearChannelCwd = (channelId: string): void => {
    channelCwds.delete(channelId)
  }

  const getChannelModel = (channelId: string): string | undefined => {
    return channelModels.get(channelId)
  }

  const setChannelModel = (channelId: string, model: string): void => {
    channelModels.set(channelId, model)
  }

  const clearChannelModel = (channelId: string): void => {
    channelModels.delete(channelId)
  }

  const getThreadChannelId = (threadId: string): string | undefined => {
    return threadChannelIds.get(threadId)
  }

  const setThreadChannelId = (threadId: string, channelId: string): void => {
    threadChannelIds.set(threadId, channelId)
  }

  const closeThread = (threadId: string): void => {
    activeThreads.delete(threadId)
    sessions.delete(threadId)
    threadCwds.delete(threadId)
    threadModels.delete(threadId)
    threadChannelIds.delete(threadId)
    threadUsage.delete(threadId)
  }

  const getUsage = (threadId: string): AiResult | undefined => {
    return threadUsage.get(threadId)
  }

  const setUsage = (threadId: string, usage: AiResult): void => {
    threadUsage.set(threadId, usage)
  }

  return {
    load,
    save,
    isActiveThread,
    activateThread,
    getSession,
    setSession,
    clearSession,
    getThreadCwd,
    getThreadModel,
    setThreadCwd,
    clearThreadCwd,
    setThreadModel,
    clearThreadModel,
    getChannelCwd,
    setChannelCwd,
    clearChannelCwd,
    getChannelModel,
    setChannelModel,
    clearChannelModel,
    getThreadChannelId,
    setThreadChannelId,
    closeThread,
    getUsage,
    setUsage,
  }
}
