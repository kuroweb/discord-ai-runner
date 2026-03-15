export interface AiAttachment {
  path: string
  name: string
  size: number
}

export interface AiResult {
  result: string
  session_id: string
  input_tokens?: number
  output_tokens?: number
  attachments?: AiAttachment[]
}

export interface AiSessionSummary {
  id: string
  summary: string
  lastModified?: number
  gitBranch?: string
  cwd?: string
}

export interface ToolApprovalRequest {
  toolName: string
  input: Record<string, unknown>
}

export type ToolApprovalDecision = 'approve' | 'deny' | 'approve-all'

export interface AiRunOptions {
  onChunk: (text: string) => void
  signal?: AbortSignal
  cwd?: string
  model?: string
  attachmentOutputDir?: string
  requestApproval?: (
    request: ToolApprovalRequest,
  ) => Promise<ToolApprovalDecision>
}

export interface AiAdapter {
  run(
    prompt: string,
    sessionId: string | undefined,
    options: AiRunOptions,
  ): Promise<AiResult>
  listSessions?(
    cwd: string,
    options?: { limit?: number },
  ): Promise<AiSessionSummary[]>
}
