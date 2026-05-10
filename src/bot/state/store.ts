import { readFileSync, writeFileSync } from 'fs'
import type { AiResult } from '../../adapters'
import type { BatchJob } from '../../batch/types'

interface PersistedThread {
  sessionId?: string
  cwd?: string
  channelId?: string
  model?: string
}

interface PersistedState {
  threads: Record<string, PersistedThread>
  channels: Record<string, { cwd?: string; model?: string }>
  batchJobs?: BatchJob[]
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
  const batchJobs = new Map<string, BatchJob>()

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
      for (const batchJob of state.batchJobs ?? []) {
        if (
          typeof batchJob?.id !== 'string' ||
          (batchJob?.name !== undefined && typeof batchJob?.name !== 'string') ||
          typeof batchJob?.cron !== 'string' ||
          typeof batchJob?.channelId !== 'string' ||
          typeof batchJob?.message !== 'string'
        ) {
          continue
        }
        batchJobs.set(batchJob.id, {
          ...batchJob,
          name: batchJob.name?.trim() || batchJob.id,
        })
      }
      console.log(
        `[state] 復元: threads=${activeThreads.size}, sessions=${sessions.size}, batchJobs=${batchJobs.size}`,
      )
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        // ファイルが存在しない場合は無視
        return
      }
      console.error('[state] 復元に失敗しました', error)
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
    const state: PersistedState = {
      threads,
      channels,
      batchJobs: Array.from(batchJobs.values()).sort((a, b) =>
        a.id.localeCompare(b.id),
      ),
    }
    writeFileSync(stateFile, JSON.stringify(state, null, 2))
  }

  const listBatchJobs = (channelId?: string): BatchJob[] => {
    const jobs = Array.from(batchJobs.values())
      .filter((job) => (channelId ? job.channelId === channelId : true))
      .sort((a, b) => a.id.localeCompare(b.id))
    return jobs
  }

  const getBatchJob = (id: string): BatchJob | undefined => {
    return batchJobs.get(id)
  }

  const createBatchJob = ({
    name,
    cron,
    channelId,
    message,
  }: Omit<BatchJob, 'id'>): BatchJob => {
    const id = (() => {
      while (true) {
        const candidate = `batch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
        if (!batchJobs.has(candidate)) {
          return candidate
        }
      }
    })()
    const job: BatchJob = { id, name, cron, channelId, message }
    batchJobs.set(job.id, job)
    return job
  }

  const updateBatchJob = (
    id: string,
    patch: Partial<Omit<BatchJob, 'id'>>,
  ): BatchJob | null => {
    const current = batchJobs.get(id)
    if (!current) return null
    const next: BatchJob = {
      ...current,
      ...patch,
      id: current.id,
    }
    batchJobs.set(id, next)
    return next
  }

  const deleteBatchJob = (id: string): boolean => {
    return batchJobs.delete(id)
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
    listBatchJobs,
    getBatchJob,
    createBatchJob,
    updateBatchJob,
    deleteBatchJob,
  }
}
