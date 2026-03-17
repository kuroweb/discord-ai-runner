import type { Client } from 'discord.js'
import type { AiAdapter } from '../../adapters/types'

export type JobContext = {
  client: Client
  adapter: AiAdapter
}

export type BatchJob = {
  id: string
  run: (ctx: JobContext) => Promise<void>
}
