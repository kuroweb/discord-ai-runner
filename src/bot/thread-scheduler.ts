export const createThreadScheduler = () => {
  const queues = new Map<string, Promise<void>>()
  const controllers = new Map<string, AbortController>()

  const abort = (threadId: string): AbortSignal => {
    controllers.get(threadId)?.abort()
    const controller = new AbortController()
    controllers.set(threadId, controller)
    return controller.signal
  }

  const enqueue = async (
    threadId: string,
    task: () => Promise<void>,
  ): Promise<void> => {
    const prev = queues.get(threadId) ?? Promise.resolve()
    const run = prev.catch(() => {}).then(task)

    queues.set(
      threadId,
      run.finally(() => {
        if (queues.get(threadId) === run) {
          queues.delete(threadId)
        }
      }),
    )

    await run
  }

  return {
    abort,
    enqueue,
  }
}
