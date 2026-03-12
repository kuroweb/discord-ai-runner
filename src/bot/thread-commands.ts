import { existsSync, statSync } from 'fs'
import { homedir } from 'os'
import { resolve } from 'path'
import { formatStatus } from './messages'
import type { createApprovalManager } from './approval-manager'
import type { createBotState } from './state'
import type { createThreadTaskManager } from './thread-task-manager'

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
  return dependencies.state.getThreadCwd(threadId) ?? process.cwd()
}

export function setThreadCwd(
  threadId: string,
  inputPath: string,
  dependencies: Pick<ThreadCommandDependencies, 'state' | 'taskManager'>,
): string {
  const baseDir = homedir()
  const normalizedInput =
    inputPath === '~'
      ? homedir()
      : inputPath.startsWith('~/')
        ? resolve(homedir(), inputPath.slice(2))
        : inputPath
  const resolvedPath = resolve(baseDir, normalizedInput)

  if (!existsSync(resolvedPath)) {
    return `❌ ディレクトリが見つかりません: \`${resolvedPath}\``
  }

  if (!statSync(resolvedPath).isDirectory()) {
    return `❌ ディレクトリではありません: \`${resolvedPath}\``
  }

  const currentCwd = dependencies.state.getThreadCwd(threadId) ?? process.cwd()
  if (currentCwd === resolvedPath) {
    return `📁 このスレッドの作業ディレクトリはすでに \`${resolvedPath}\` です。`
  }

  dependencies.taskManager.nextRevision(threadId)
  dependencies.state.clearSession(threadId)
  dependencies.state.setThreadCwd(threadId, resolvedPath)
  dependencies.state.save()
  return `📁 このスレッドの作業ディレクトリを \`${resolvedPath}\` に設定しました。変更に合わせて、このスレッドのセッションもリセットしました。`
}
