export interface AiAttachment {
  path: string
  name: string
  size: number
}

export interface AiTextInputPart {
  type: 'text'
  text: string
}

export interface AiImageInputPart {
  type: 'image'
  filename: string
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
  data: Buffer
  size: number
}

export interface AiPdfInputPart {
  type: 'pdf'
  filename: string
  mediaType: 'application/pdf'
  data: Buffer
  size: number
}

export type AiInputPart = AiTextInputPart | AiImageInputPart | AiPdfInputPart

export interface AiInput {
  parts: AiInputPart[]
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
  cwd: string
  model?: string
  attachmentOutputDir?: string
  requestApproval?: (
    request: ToolApprovalRequest,
  ) => Promise<ToolApprovalDecision>
}

export interface AiAdapter {
  run(
    input: AiInput,
    sessionId: string | undefined,
    options: AiRunOptions,
  ): Promise<AiResult>
  listSessions?(
    cwd: string,
    options?: { limit?: number },
  ): Promise<AiSessionSummary[]>
}
