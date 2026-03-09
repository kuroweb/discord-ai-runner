export interface AiResult {
  result: string
  session_id: string
  input_tokens?: number
  output_tokens?: number
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
}
