import type { BatchJob } from './types'
import { heartbeatJob } from './jobs/heartbeat'
import { dailyDigestJob } from './jobs/daily-digest'

const dailyDigestCron = process.env.DAILY_DIGEST_CRON ?? '0 9 * * *'
const dailyDigestChannelId = process.env.DAILY_DIGEST_CHANNEL_ID ?? ''

export const schedule: Array<{
  cron: string
  job: BatchJob
  channelId: string
}> = [
  { cron: '* * * * *', job: heartbeatJob, channelId: '' },
  {
    cron: dailyDigestCron,
    job: dailyDigestJob,
    channelId: dailyDigestChannelId,
  },
]
