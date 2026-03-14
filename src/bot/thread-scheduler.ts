export function createThreadScheduler() {
  const queues = new Map<string, Promise<void>>()
  const controllers = new Map<string, AbortController>()

  function abort(threadId: string): AbortSignal {
    controllers.get(threadId)?.abort()
    const controller = new AbortController()
    controllers.set(threadId, controller)
    return controller.signal
  }

  async function enqueue(
    threadId: string,
    task: () => Promise<void>,
  ): Promise<void> {
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
