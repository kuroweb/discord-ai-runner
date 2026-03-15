import { readFileSync, writeFileSync } from 'fs'
import type { AiResult } from '../adapters'

interface PersistedThread {
  sessionId?: string
  cwd?: string
  channelId?: string
  model?: string
}

interface PersistedState {
  threads: Record<string, PersistedThread>
  channels: Record<string, { cwd: string }>
}

export function createBotState(stateFile: string) {
  const activeThreads = new Set<string>()
  const sessions = new Map<string, string>()
  const threadCwds = new Map<string, string>()
  const threadModels = new Map<string, string>()
  const channelCwds = new Map<string, string>()
  const threadChannelIds = new Map<string, string>()
  const threadUsage = new Map<string, AiResult>()

  function load(): void {
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
        channelCwds.set(channelId, channel.cwd)
      }
      console.log(
        `[state] 復元: threads=${activeThreads.size}, sessions=${sessions.size}`,
      )
    } catch {
      // ファイルが存在しない場合は無視
    }
  }

  function save(): void {
    const threads: Record<string, PersistedThread> = {}
    for (const threadId of activeThreads) {
      threads[threadId] = {
        sessionId: sessions.get(threadId),
        cwd: threadCwds.get(threadId),
        channelId: threadChannelIds.get(threadId),
        model: threadModels.get(threadId),
      }
    }
    const channels: Record<string, { cwd: string }> = {}
    for (const [channelId, cwd] of channelCwds) {
      channels[channelId] = { cwd }
    }
    const state: PersistedState = { threads, channels }
    writeFileSync(stateFile, JSON.stringify(state, null, 2))
  }

  function isActiveThread(threadId: string): boolean {
    return activeThreads.has(threadId)
  }

  function activateThread(threadId: string, channelId?: string): void {
    activeThreads.add(threadId)
    if (channelId) {
      threadChannelIds.set(threadId, channelId)
    }
  }

  function getSession(threadId: string): string | undefined {
    return sessions.get(threadId)
  }

  function setSession(threadId: string, sessionId: string): void {
    sessions.set(threadId, sessionId)
  }

  function clearSession(threadId: string): void {
    sessions.delete(threadId)
    threadUsage.delete(threadId)
  }

  function getThreadCwd(threadId: string): string | undefined {
    return threadCwds.get(threadId)
  }

  function getThreadModel(threadId: string): string | undefined {
    return threadModels.get(threadId)
  }

  function setThreadCwd(threadId: string, cwd: string): void {
    threadCwds.set(threadId, cwd)
  }

  function clearThreadCwd(threadId: string): void {
    threadCwds.delete(threadId)
  }

  function setThreadModel(threadId: string, model: string): void {
    threadModels.set(threadId, model)
  }

  function clearThreadModel(threadId: string): void {
    threadModels.delete(threadId)
  }

  function getChannelCwd(channelId: string): string | undefined {
    return channelCwds.get(channelId)
  }

  function setChannelCwd(channelId: string, cwd: string): void {
    channelCwds.set(channelId, cwd)
  }

  function clearChannelCwd(channelId: string): void {
    channelCwds.delete(channelId)
  }

  function getThreadChannelId(threadId: string): string | undefined {
    return threadChannelIds.get(threadId)
  }

  function setThreadChannelId(threadId: string, channelId: string): void {
    threadChannelIds.set(threadId, channelId)
  }

  function closeThread(threadId: string): void {
    activeThreads.delete(threadId)
    sessions.delete(threadId)
    threadCwds.delete(threadId)
    threadModels.delete(threadId)
    threadChannelIds.delete(threadId)
    threadUsage.delete(threadId)
  }

  function getUsage(threadId: string): AiResult | undefined {
    return threadUsage.get(threadId)
  }

  function setUsage(threadId: string, usage: AiResult): void {
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
    getThreadChannelId,
    setThreadChannelId,
    closeThread,
    getUsage,
    setUsage,
  }
}
