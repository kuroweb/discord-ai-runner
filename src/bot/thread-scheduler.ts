export const createThreadScheduler = () => {
  const queues = new Map<string, Promise<void>>()
  const controllers = new Map<string, AbortController>()

  const abort = (threadId: string): void => {
    controllers.get(threadId)?.abort()
  }

  const createSignal = (threadId: string): AbortSignal => {
    const controller = new AbortController()
    controllers.set(threadId, controller)
    return controller.signal
  }

  const enqueue = async (
    threadId: string,
    task: (signal: AbortSignal) => Promise<void>,
  ): Promise<void> => {
    abort(threadId)
    const signal = createSignal(threadId)
    const prev = queues.get(threadId) ?? Promise.resolve()
    const run = prev.catch(() => {}).then(() => task(signal))

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
