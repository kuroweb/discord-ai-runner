import type { Client } from 'discord.js'
import type { AiAdapter } from '../adapters/types'
import type { createBotState } from '../bot/state'

type BotState = ReturnType<typeof createBotState>

export type BatchState = Pick<
  BotState,
  'activateThread' | 'setSession' | 'save' | 'getChannelCwd' | 'getChannelModel'
>

export type JobContext = {
  client: Client
  adapter: AiAdapter
  state: BatchState
  channelId: string
}

export type BatchJob = {
  id: string
  run: (ctx: JobContext) => Promise<void>
}
