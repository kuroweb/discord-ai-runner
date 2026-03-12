import { formatStatus } from './messages'
import type { createApprovalManager } from './approval-manager'
import type { createBotState } from './state'
import type { createThreadTaskManager } from './thread-task-manager'
import {
  normalizeDirectoryPath,
  resolveChannelDefaultCwd,
  resolveThreadCwd,
  validateDirectoryPath,
} from './cwd'

interface ThreadCommandDependencies {
  state: ReturnType<typeof createBotState>
  taskManager: ReturnType<typeof createThreadTaskManager>
  approvalManager: ReturnType<typeof createApprovalManager>
}

export function resetThreadSession(
  threadId: string,
  dependencies: ThreadCommandDependencies,
): string {
  const { state, taskManager, approvalManager } = dependencies
  taskManager.nextRevision(threadId)
  state.clearSession(threadId)
  state.clearThreadCwd(threadId)
  approvalManager.clearAutoApprove(threadId)
  state.save()
  return 'セッションと作業ディレクトリをリセットしました。'
}

export function getThreadStatus(
  threadId: string,
  dependencies: Pick<ThreadCommandDependencies, 'state'>,
): string {
  const usage = dependencies.state.getUsage(threadId)
  if (!usage) {
    return '（このセッションはまだ利用データがありません）'
  }
  return formatStatus(usage)
}

export function getThreadCwd(
  threadId: string,
  dependencies: Pick<ThreadCommandDependencies, 'state'>,
): string {
  return resolveThreadCwd(dependencies.state, threadId)
}

export function setThreadCwd(
  threadId: string,
  inputPath: string,
  dependencies: Pick<ThreadCommandDependencies, 'state' | 'taskManager'>,
): string {
  const resolvedPath = normalizeDirectoryPath(inputPath)
  const validationError = validateDirectoryPath(resolvedPath)
  if (validationError) {
    return validationError
  }

  const currentCwd = getThreadCwd(threadId, dependencies)
  if (currentCwd === resolvedPath) {
    return `📁 このスレッドの作業ディレクトリはすでに \`${resolvedPath}\` です。`
  }

  dependencies.taskManager.nextRevision(threadId)
  dependencies.state.clearSession(threadId)
  dependencies.state.setThreadCwd(threadId, resolvedPath)
  dependencies.state.save()
  return `📁 このスレッドの作業ディレクトリを \`${resolvedPath}\` に設定しました。変更に合わせて、このスレッドのセッションもリセットしました。`
}

export function getChannelDefaultCwd(
  channelId: string,
  dependencies: Pick<ThreadCommandDependencies, 'state'>,
): string {
  return resolveChannelDefaultCwd(dependencies.state, channelId)
}

export function setChannelDefaultCwd(
  channelId: string,
  inputPath: string,
  dependencies: Pick<ThreadCommandDependencies, 'state'>,
): string {
  const resolvedPath = normalizeDirectoryPath(inputPath)
  const validationError = validateDirectoryPath(resolvedPath)
  if (validationError) {
    return validationError
  }

  const currentCwd = resolveChannelDefaultCwd(dependencies.state, channelId)
  if (currentCwd === resolvedPath) {
    return `📁 このチャンネルのデフォルト作業ディレクトリはすでに \`${resolvedPath}\` です。`
  }

  dependencies.state.setChannelCwd(channelId, resolvedPath)
  dependencies.state.save()
  return `📁 このチャンネルのデフォルト作業ディレクトリを \`${resolvedPath}\` に設定しました。新しく作成されるスレッドで自動的に使われます。`
}
