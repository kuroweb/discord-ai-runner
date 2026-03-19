import type { Client } from 'discord.js'
import type { AiAdapter } from '../adapters/types'
import type { createApprovalManager } from '../bot/approval'
import type { createBotState } from '../bot/state'
import type { createThreadScheduler } from '../bot/thread-scheduler'

type BotState = ReturnType<typeof createBotState>

export type BatchState = BotState

export type JobContext = {
  client: Client
  adapter: AiAdapter
  state: BatchState
  scheduler: ReturnType<typeof createThreadScheduler>
  approvalManager: ReturnType<typeof createApprovalManager>
  channelId: string
}

export type BatchJob = {
  id: string
  run: (ctx: JobContext) => Promise<void>
}
