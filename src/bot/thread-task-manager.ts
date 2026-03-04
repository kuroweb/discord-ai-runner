export function createThreadTaskManager() {
  const threadQueues = new Map<string, Promise<void>>();
  const threadRevisions = new Map<string, number>();

  function nextRevision(threadId: string): number {
    const next = (threadRevisions.get(threadId) ?? 0) + 1;
    threadRevisions.set(threadId, next);
    return next;
  }

  function isCurrentRevision(threadId: string, revision: number): boolean {
    return (threadRevisions.get(threadId) ?? 0) === revision;
  }

  async function enqueue(threadId: string, task: () => Promise<void>): Promise<void> {
    const prev = threadQueues.get(threadId) ?? Promise.resolve();
    const run = prev
      .catch(() => {})
      .then(task);

    threadQueues.set(
      threadId,
      run.finally(() => {
        if (threadQueues.get(threadId) === run) {
          threadQueues.delete(threadId);
        }
      }),
    );

    await run;
  }

  return {
    nextRevision,
    isCurrentRevision,
    enqueue,
  };
}
