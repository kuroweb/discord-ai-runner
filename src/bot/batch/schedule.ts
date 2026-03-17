import type { BatchJob } from './types'
import { heartbeatJob } from './jobs/heartbeat'

export const schedule: Array<{ cron: string; job: BatchJob }> = [
  { cron: '* * * * *', job: heartbeatJob },
]
