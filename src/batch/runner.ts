import cron, { type ScheduledTask } from 'node-cron'
import { ChannelType } from 'discord.js'
import type { AiInput } from '../adapters'
import { buildThreadName } from '../bot/messages'
import { respond } from '../bot/respond'
import type { BatchJob, JobContext } from './types'

type BatchRunnerContext = Omit<JobContext, 'channelId'>

export function createBatchRunner(baseCtx: BatchRunnerContext) {
  const tasks = new Map<string, ScheduledTask>()
  const runningJobs = new Set<string>()
  let isStarted = false

  function add(job: BatchJob): void {
    if (tasks.has(job.id)) {
      console.warn(`[batch] ジョブ "${job.id}" は既に登録済みです`)
      return
    }
    const task = cron.createTask(job.cron, async () => {
      if (runningJobs.has(job.id)) {
        console.warn(`[batch] ジョブ重複スキップ: ${job.id}`)
        return
      }
      runningJobs.add(job.id)
      console.log(`[batch] ジョブ開始: ${job.id}`)
      try {
        await run(job)
        console.log(`[batch] ジョブ完了: ${job.id}`)
      } catch (error) {
        console.error(`[batch] ジョブ失敗: ${job.id}`, error)
      } finally {
        runningJobs.delete(job.id)
      }
    })
    tasks.set(job.id, task)
    if (isStarted) {
      task.start()
      console.log(`[batch] スケジュール登録: ${job.id}`)
    }
  }

  function remove(jobId: string): void {
    const task = tasks.get(jobId)
    if (!task) {
      console.warn(`[batch] スケジュール解除スキップ（未登録）: ${jobId}`)
      return
    }
    task.stop()
    tasks.delete(jobId)
    console.log(`[batch] スケジュール解除: ${jobId}`)
  }

  function replace(job: BatchJob): void {
    remove(job.id)
    add(job)
  }

  function start(): void {
    isStarted = true
    for (const [id, task] of tasks) {
      task.start()
      console.log(`[batch] スケジュール登録: ${id}`)
    }
  }

  function stop(): void {
    isStarted = false
    for (const task of tasks.values()) {
      task.stop()
    }
  }

  async function run(job: BatchJob): Promise<void> {
    const channel = await baseCtx.client.channels.fetch(job.channelId)
    if (!channel) {
      console.warn(`[batch] channel not found: ${job.channelId}`)
      return
    }
    if (
      channel.type !== ChannelType.GuildText &&
      channel.type !== ChannelType.GuildAnnouncement
    ) {
      console.warn(`[batch] unsupported channel type: ${channel.type}`)
      return
    }

    const kickoff = await channel.send(
      `バッチジョブを開始しました: ${job.name}`,
    )
    const thread = await kickoff.startThread({
      name: buildThreadName(job.name),
      autoArchiveDuration: 1440,
      reason: `batch job: ${job.id}`,
    })

    baseCtx.state.activateThread(thread.id, job.channelId)
    baseCtx.state.save()
    baseCtx.approvalManager.enableAutoApprove(thread.id)

    const input: AiInput = {
      parts: [{ type: 'text', text: job.message }],
    }

    await baseCtx.scheduler.enqueue(thread.id, async (signal) => {
      await respond(thread, thread, input, thread.id, signal, {
        adapter: baseCtx.adapter,
        state: baseCtx.state,
        approvalManager: baseCtx.approvalManager,
      })
    })
  }

  return {
    add,
    remove,
    replace,
    start,
    stop,
  }
}
