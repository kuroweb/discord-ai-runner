import cron, { type ScheduledTask } from 'node-cron'
import type { BatchJob, JobContext } from './types'

type BatchRunnerContext = Omit<JobContext, 'channelId'>

export function createBatchRunner(baseCtx: BatchRunnerContext) {
  const tasks = new Map<string, ScheduledTask>()
  const runningJobs = new Set<string>()

  function register(schedule: string, job: BatchJob, channelId: string): void {
    if (tasks.has(job.id)) {
      console.warn(`[batch] ジョブ "${job.id}" は既に登録済みです`)
      return
    }
    const task = cron.createTask(schedule, async () => {
      if (runningJobs.has(job.id)) {
        console.warn(`[batch] ジョブ重複スキップ: ${job.id}`)
        return
      }
      runningJobs.add(job.id)
      console.log(`[batch] ジョブ開始: ${job.id}`)
      try {
        await job.run({ ...baseCtx, channelId })
        console.log(`[batch] ジョブ完了: ${job.id}`)
      } catch (error) {
        console.error(`[batch] ジョブ失敗: ${job.id}`, error)
      } finally {
        runningJobs.delete(job.id)
      }
    })
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
