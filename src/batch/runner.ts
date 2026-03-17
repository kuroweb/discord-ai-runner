import cron from 'node-cron'
import type { BatchJob, JobContext } from './types'

export function createBatchRunner(ctx: JobContext) {
  const tasks = new Map<string, cron.ScheduledTask>()

  function register(schedule: string, job: BatchJob): void {
    if (tasks.has(job.id)) {
      console.warn(`[batch] ジョブ "${job.id}" は既に登録済みです`)
      return
    }
    const task = cron.schedule(
      schedule,
      async () => {
        console.log(`[batch] ジョブ開始: ${job.id}`)
        try {
          await job.run(ctx)
          console.log(`[batch] ジョブ完了: ${job.id}`)
        } catch (error) {
          console.error(`[batch] ジョブ失敗: ${job.id}`, error)
        }
      },
      { scheduled: false },
    )
    tasks.set(job.id, task)
  }

  function start(): void {
    for (const [id, task] of tasks) {
      task.start()
      console.log(`[batch] スケジュール登録: ${id}`)
    }
  }

  function stop(): void {
    for (const task of tasks.values()) {
      task.stop()
    }
  }

  return { register, start, stop }
}
