import type { BatchJob } from '../types'

export const heartbeatJob: BatchJob = {
  id: 'heartbeat',
  run: async () => {
    console.log('[batch] heartbeat: Bot は正常に動作中です')
  },
}
