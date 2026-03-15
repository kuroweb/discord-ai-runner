import type { AiAdapter } from '../../adapters'
import type { createApprovalManager } from '../approval-manager'
import type { createBotState } from '../state'
import type { createThreadScheduler } from '../thread-scheduler'

export interface CommandDependencies {
  adapterName: string
  adapter: AiAdapter
  state: ReturnType<typeof createBotState>
  scheduler: ReturnType<typeof createThreadScheduler>
  approvalManager: ReturnType<typeof createApprovalManager>
}
