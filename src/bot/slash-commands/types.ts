import type { AiAdapter } from '../../adapters'
import type { createApprovalManager } from '../approval-manager'
import type { createBotState } from '../state'
import type { createThreadTaskManager } from '../thread-task-manager'

export interface CommandDependencies {
  adapter: AiAdapter
  state: ReturnType<typeof createBotState>
  taskManager: ReturnType<typeof createThreadTaskManager>
  approvalManager: ReturnType<typeof createApprovalManager>
}
