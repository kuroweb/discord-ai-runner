import { spawn } from 'child_process'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { extname, join } from 'path'
import type {
  AiAdapter,
  AiInput,
  AiInputPart,
  AiResult,
  AiRunOptions,
  AiSessionSummary,
  ToolApprovalDecision,
} from '../types'
import { collectAttachments } from '../attachments'
import { buildSystemPrompt } from '../../bot/prompts/system-prompt'

type RequestId = string | number

interface JsonRpcRequest {
  id: RequestId
  method: string
  params?: unknown
}

interface JsonRpcResponse {
  id: RequestId
  result?: unknown
  error?: unknown
}

interface PendingRequest {
  resolve: (result: unknown) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

interface CodexThreadListResponse {
  data?: Array<{
    id?: string
    preview?: string
    updatedAt?: number
    cwd?: string
    gitInfo?: {
      branch?: string
    } | null
  }>
}

const REQUEST_TIMEOUT_MS = 30_000
interface CodexTextInput {
  type: 'text'
  text: string
  text_elements: unknown[]
}

interface CodexLocalImageInput {
  type: 'localImage'
  path: string
}

type CodexUserInput = CodexTextInput | CodexLocalImageInput

function buildPromptText(input: AiInput): string {
  const chunks: string[] = []

  for (const part of input.parts) {
    if (part.type === 'text') {
      chunks.push(part.text)
      continue
    }

    if (part.type === 'image') {
      chunks.push(`添付画像: ${part.filename}`)
    }
  }

  return chunks.filter(Boolean).join('\n\n')
}

function extensionForImagePart(
  part: Extract<AiInputPart, { type: 'image' }>,
): string {
  const existingExt = extname(part.filename)
  if (existingExt) return existingExt
  if (part.mediaType === 'image/jpeg') return '.jpg'
  if (part.mediaType === 'image/png') return '.png'
  if (part.mediaType === 'image/gif') return '.gif'
  return '.webp'
}

async function buildUserInput(
  promptText: string,
  imageParts: Array<Extract<AiInputPart, { type: 'image' }>>,
  imageInputDir: string,
): Promise<CodexUserInput[]> {
  const userInputs: CodexUserInput[] = [
    {
      type: 'text',
      text: promptText,
      text_elements: [],
    },
  ]
  let imageIndex = 0

  for (const part of imageParts) {
    imageIndex += 1
    const imagePath = join(
      imageInputDir,
      `input-${imageIndex}${extensionForImagePart(part)}`,
    )
    await writeFile(imagePath, part.data)
    userInputs.push({
      type: 'localImage',
      path: imagePath,
    })
  }

  return userInputs
}

function mapDecision(
  decision: ToolApprovalDecision,
): 'accept' | 'acceptForSession' | 'decline' {
  if (decision === 'approve-all') return 'acceptForSession'
  if (decision === 'approve') return 'accept'
  return 'decline'
}

function mapLegacyDecision(decision: ToolApprovalDecision): 'allow' | 'deny' {
  return decision === 'deny' ? 'deny' : 'allow'
}

function extractThreadId(result: unknown): string | null {
  const obj = result as any
  return obj?.thread?.id ?? null
}

function extractTurnUsage(notificationParams: unknown): {
  input?: number
  output?: number
} {
  const params = notificationParams as any
  const usage = params?.turn?.tokenUsage ?? params?.tokenUsage
  const total = usage?.last ?? usage?.total
  return {
    input: total?.inputTokens,
    output: total?.outputTokens,
  }
}

function summarizeCodexPreview(preview: string): string {
  const trimmed = preview.trim()
  if (!trimmed) return ''

  const body = trimmed.includes('\n---\n')
    ? (trimmed.split('\n---\n').pop() ?? trimmed)
    : trimmed

  const firstLine =
    body
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? ''

  const normalized = firstLine.replace(/\s+/g, ' ').trim()
  if (normalized.length <= 120) return normalized
  return `${normalized.slice(0, 117)}...`
}

export function createCodexAdapter(): AiAdapter {
  async function run(
    input: AiInput,
    sessionId: string | undefined,
    options: AiRunOptions,
  ): Promise<AiResult> {
    const {
      onChunk,
      signal,
      cwd = process.cwd(),
      model,
      requestApproval,
      attachmentOutputDir,
    } = options
    const procArgs = ['app-server']
    if (model) {
      procArgs.push('-c', `model="${model}"`)
    }
    procArgs.push('--listen', 'stdio://')
    const proc = spawn('codex', procArgs, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let nextId = 1
    const pending = new Map<RequestId, PendingRequest>()
    let lineBuffer = ''
    let accumulatedText = ''
    let resolvedThreadId = sessionId ?? ''
    let usageInput: number | undefined
    let usageOutput: number | undefined
    const imageInputDir = await mkdtemp(
      join(tmpdir(), 'discord-ai-runner-codex-input-'),
    )

    let runResolve: ((result: AiResult) => void) | null = null
    let runReject: ((error: Error) => void) | null = null
    let settled = false
    const completed = new Promise<AiResult>((resolve, reject) => {
      runResolve = (result) => {
        if (settled) return
        settled = true
        resolve(result)
      }
      runReject = (error) => {
        if (settled) return
        settled = true
        reject(error)
      }
    })

    async function resolveCompletedTurn(): Promise<void> {
      runResolve?.({
        result: accumulatedText || '（応答なし）',
        session_id: resolvedThreadId,
        input_tokens: usageInput,
        output_tokens: usageOutput,
        attachments: await collectAttachments(attachmentOutputDir),
      })
    }

    function rejectAll(err: Error): void {
      for (const request of pending.values()) {
        clearTimeout(request.timer)
        request.reject(err)
      }
      pending.clear()
      runReject?.(err)
    }

    function send(message: object): void {
      proc.stdin.write(`${JSON.stringify(message)}\n`)
    }

    function request(method: string, params: unknown): Promise<unknown> {
      const id = nextId++
      send({ id, method, params } satisfies JsonRpcRequest)
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id)
          reject(new Error(`request timeout: ${method}`))
        }, REQUEST_TIMEOUT_MS)
        pending.set(id, { resolve, reject, timer })
      })
    }

    async function handleServerRequest(message: JsonRpcRequest): Promise<void> {
      const { id, method, params } = message
      if (id === undefined || id === null) return

      if (method === 'item/commandExecution/requestApproval') {
        const p = params as any
        const command = p?.command ?? ''
        const decision = requestApproval
          ? await requestApproval({ toolName: 'Bash', input: { command } })
          : 'deny'
        send({ id, result: { decision: mapDecision(decision) } })
        return
      }

      if (method === 'execCommandApproval') {
        const p = params as any
        const command = p?.command ?? ''
        const decision = requestApproval
          ? await requestApproval({ toolName: 'Bash', input: { command } })
          : 'deny'
        send({ id, result: { decision: mapLegacyDecision(decision) } })
        return
      }

      if (method === 'item/fileChange/requestApproval') {
        const p = params as any
        const decision = requestApproval
          ? await requestApproval({
              toolName: 'Edit',
              input: {
                reason: p?.reason ?? '',
                grantRoot: p?.grantRoot ?? null,
              },
            })
          : 'deny'
        send({ id, result: { decision: mapDecision(decision) } })
        return
      }

      if (method === 'applyPatchApproval') {
        const p = params as any
        const decision = requestApproval
          ? await requestApproval({
              toolName: 'Edit',
              input: {
                reason: p?.reason ?? '',
                grantRoot: p?.grantRoot ?? null,
              },
            })
          : 'deny'
        send({ id, result: { decision: mapLegacyDecision(decision) } })
        return
      }

      if (method === 'item/tool/requestUserInput') {
        const p = params as any
        const answers: Record<string, { answers: string[] }> = {}
        for (const q of p?.questions ?? []) {
          const first = q?.options?.[0]?.label
          answers[q.id] = { answers: first ? [first] : [] }
        }
        send({ id, result: { answers } })
        return
      }

      if (method === 'item/tool/call') {
        send({
          id,
          result: {
            content: [
              {
                type: 'inputText',
                text: 'Unsupported dynamic tool in this runner.',
              },
            ],
          },
        })
        return
      }

      send({ id, result: {} })
    }

    proc.on('error', (err) => {
      rejectAll(err instanceof Error ? err : new Error(String(err)))
    })

    proc.stderr.on('data', (data: Buffer) => {
      const text = data.toString().trim()
      if (text) {
        console.error('[codex-app-server] stderr:', text)
      }
    })

    proc.stdout.on('data', (data: Buffer) => {
      lineBuffer += data.toString()
      const lines = lineBuffer.split('\n')
      lineBuffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        let message: any
        try {
          message = JSON.parse(line)
        } catch {
          continue
        }

        if (typeof message?.method === 'string' && message?.id !== undefined) {
          void handleServerRequest(message as JsonRpcRequest).catch((error) => {
            const req = message as JsonRpcRequest
            if (req.id !== undefined && req.id !== null) {
              send({ id: req.id, result: { decision: 'decline' } })
            }
            console.error('[codex-app-server] request handling error:', error)
          })
          continue
        }

        if (
          message?.id !== undefined &&
          (Object.prototype.hasOwnProperty.call(message, 'result') ||
            Object.prototype.hasOwnProperty.call(message, 'error'))
        ) {
          const pendingReq = pending.get(message.id)
          if (!pendingReq) continue
          pending.delete(message.id)
          clearTimeout(pendingReq.timer)
          if (message.error) {
            pendingReq.reject(
              new Error(
                typeof message.error?.message === 'string'
                  ? message.error.message
                  : 'JSON-RPC error',
              ),
            )
          } else {
            pendingReq.resolve((message as JsonRpcResponse).result)
          }
          continue
        }

        if (typeof message?.method === 'string') {
          const method = message.method as string
          const params = message.params

          if (method === 'thread/started') {
            const thread = (params as any)?.thread
            if (thread?.id) resolvedThreadId = thread.id
            continue
          }

          if (method === 'item/agentMessage/delta') {
            const delta = (params as any)?.delta
            if (typeof delta === 'string' && delta.length > 0) {
              accumulatedText += delta
              onChunk(accumulatedText)
            }
            continue
          }

          if (method === 'item/completed') {
            const item = (params as any)?.item
            if (
              item?.type === 'agentMessage' &&
              typeof item.text === 'string' &&
              !accumulatedText
            ) {
              accumulatedText = item.text
              onChunk(accumulatedText)
            }
            continue
          }

          if (
            method === 'thread/tokenUsage/updated' ||
            method === 'turn/completed'
          ) {
            const usage = extractTurnUsage(params)
            usageInput = usage.input ?? usageInput
            usageOutput = usage.output ?? usageOutput
          }

          if (method === 'turn/completed') {
            void resolveCompletedTurn().catch((error) => {
              runReject?.(
                error instanceof Error ? error : new Error(String(error)),
              )
            })
          }

          if (method === 'error') {
            const p = params as any
            const willRetry = Boolean(p?.willRetry)
            const errMessage =
              p?.error?.message ?? p?.message ?? 'codex turn failed'
            if (willRetry) {
              console.warn(
                '[codex-app-server] transient error:',
                String(errMessage),
              )
              continue
            }
            runReject?.(new Error(String(errMessage)))
          }
        }
      }
    })

    proc.on('close', (code) => {
      if (!settled) {
        rejectAll(
          new Error(`codex app-server closed unexpectedly (code=${code})`),
        )
      }
    })

    signal?.addEventListener(
      'abort',
      () => {
        proc.kill()
        runReject?.(new DOMException('aborted', 'AbortError'))
      },
      { once: true },
    )

    try {
      // 1) initialize
      await request('initialize', {
        clientInfo: {
          name: 'discord-ai-runner',
          title: 'discord-ai-runner',
          version: '0.1.0',
        },
        capabilities: {
          experimentalApi: false,
        },
      })

      // 2) create or resume thread
      if (sessionId) {
        const resumeResult = await request('thread/resume', {
          threadId: sessionId,
          approvalPolicy: 'on-request',
          cwd,
        })
        const resumed = extractThreadId(resumeResult)
        if (resumed) resolvedThreadId = resumed
      } else {
        const startResult = await request('thread/start', {
          approvalPolicy: 'on-request',
          sandbox: 'workspace-write',
          experimentalRawEvents: false,
          cwd,
        })
        const started = extractThreadId(startResult)
        if (started) resolvedThreadId = started
      }

      // 3) start turn
      const prompt = buildSystemPrompt(buildPromptText(input), {
        attachmentOutputDir,
      })
      const imageParts = input.parts.filter(
        (part): part is Extract<AiInputPart, { type: 'image' }> =>
          part.type === 'image',
      )
      const turnInput = await buildUserInput(prompt, imageParts, imageInputDir)
      await request('turn/start', {
        threadId: resolvedThreadId,
        input: turnInput,
      })

      const result = await completed
      return result
    } finally {
      proc.kill()
      await rm(imageInputDir, { recursive: true, force: true })
    }
  }

  async function listCodexSessions(
    cwd: string,
    options?: { limit?: number },
  ): Promise<AiSessionSummary[]> {
    const proc = spawn('codex', ['app-server', '--listen', 'stdio://'], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let nextId = 1
    const pending = new Map<RequestId, PendingRequest>()
    let lineBuffer = ''

    function rejectAll(err: Error): void {
      for (const request of pending.values()) {
        clearTimeout(request.timer)
        request.reject(err)
      }
      pending.clear()
    }

    function send(message: object): void {
      proc.stdin.write(`${JSON.stringify(message)}\n`)
    }

    function request(method: string, params: unknown): Promise<unknown> {
      const id = nextId++
      send({ id, method, params } satisfies JsonRpcRequest)
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id)
          reject(new Error(`request timeout: ${method}`))
        }, REQUEST_TIMEOUT_MS)
        pending.set(id, { resolve, reject, timer })
      })
    }

    proc.on('error', (err) => {
      rejectAll(err instanceof Error ? err : new Error(String(err)))
    })

    proc.stdout.on('data', (data: Buffer) => {
      lineBuffer += data.toString()
      const lines = lineBuffer.split('\n')
      lineBuffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        let message: any
        try {
          message = JSON.parse(line)
        } catch {
          continue
        }

        if (
          message?.id !== undefined &&
          (Object.prototype.hasOwnProperty.call(message, 'result') ||
            Object.prototype.hasOwnProperty.call(message, 'error'))
        ) {
          const pendingReq = pending.get(message.id)
          if (!pendingReq) continue
          pending.delete(message.id)
          clearTimeout(pendingReq.timer)
          if (message.error) {
            pendingReq.reject(
              new Error(
                typeof message.error?.message === 'string'
                  ? message.error.message
                  : 'JSON-RPC error',
              ),
            )
          } else {
            pendingReq.resolve((message as JsonRpcResponse).result)
          }
          continue
        }

        if (typeof message?.method === 'string' && message?.id !== undefined) {
          send({ id: message.id, result: {} })
        }
      }
    })

    proc.stderr.on('data', (data: Buffer) => {
      const text = data.toString().trim()
      if (text) {
        console.error('[codex-app-server] stderr:', text)
      }
    })

    try {
      await request('initialize', {
        clientInfo: {
          name: 'discord-ai-runner',
          title: 'discord-ai-runner',
          version: '0.1.0',
        },
        capabilities: {
          experimentalApi: false,
        },
      })

      const result = (await request('thread/list', {
        cwd,
        limit: options?.limit ?? 10,
      })) as CodexThreadListResponse

      return (result.data ?? [])
        .filter(
          (thread): thread is NonNullable<typeof thread> & { id: string } =>
            typeof thread?.id === 'string' && thread.id.length > 0,
        )
        .map((thread) => ({
          id: thread.id,
          summary:
            summarizeCodexPreview(thread.preview ?? '') || '（タイトルなし）',
          lastModified:
            typeof thread.updatedAt === 'number'
              ? thread.updatedAt * 1000
              : undefined,
          gitBranch: thread.gitInfo?.branch,
          cwd: thread.cwd,
        }))
    } finally {
      rejectAll(new Error('codex app-server closed'))
      proc.kill()
    }
  }

  return {
    run,
    listSessions: listCodexSessions,
  }
}
