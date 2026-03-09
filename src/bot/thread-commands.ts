import { formatStatus } from './messages';
import type { createApprovalManager } from './approval-manager';
import type { createBotState } from './state';
import type { createThreadTaskManager } from './thread-task-manager';

interface ThreadCommandDependencies {
  state: ReturnType<typeof createBotState>;
  taskManager: ReturnType<typeof createThreadTaskManager>;
  approvalManager: ReturnType<typeof createApprovalManager>;
}

export function resetThreadSession(
  threadId: string,
  dependencies: ThreadCommandDependencies,
): string {
  const { state, taskManager, approvalManager } = dependencies;
  taskManager.nextRevision(threadId);
  state.clearSession(threadId);
  approvalManager.clearAutoApprove(threadId);
  state.save();
  return 'セッションをリセットしました。';
}

export function getThreadStatus(
  threadId: string,
  dependencies: Pick<ThreadCommandDependencies, 'state'>,
): string {
  const usage = dependencies.state.getUsage(threadId);
  if (!usage) {
    return '（このセッションはまだ利用データがありません）';
  }
  return formatStatus(usage);
}
