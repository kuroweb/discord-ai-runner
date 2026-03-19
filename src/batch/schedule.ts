import type { BatchJob } from './types'
import { dailyDigestJob } from './jobs/daily-digest'

const dailyDigestCron = '0 8 * * *'
const dailyDigestChannelId = '1484243402773237970'

export const schedule: Array<{
  cron: string
  job: BatchJob
  channelId: string
}> = [
  {
    cron: dailyDigestCron,
    job: dailyDigestJob,
    channelId: dailyDigestChannelId,
  },
]
