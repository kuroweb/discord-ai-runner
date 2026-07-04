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
} from '../types'
import { collectAttachments } from '../attachments'
import { resolveSpawnCmd } from '../resolve-spawn-cmd'
import { buildSystemPrompt } from '../../bot/system-prompts'

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

async function buildPromptText(
  input: AiInput,
  imageInputDir: string,
): Promise<string> {
  const chunks: string[] = []
  let imageIndex = 0

  for (const part of input.parts) {
    if (part.type === 'text') {
      chunks.push(part.text)
      continue
    }

    // cursor-agent CLI は画像の直接入力に非対応のため、
    // 一時ファイルに保存してパスを渡し、エージェント側で読み取らせる
    if (part.type === 'image') {
      imageIndex += 1
      const imagePath = join(
        imageInputDir,
        `input-${imageIndex}${extensionForImagePart(part)}`,
      )
      await writeFile(imagePath, part.data)
      chunks.push(`添付画像（${part.filename}）: ${imagePath}`)
    }
  }

  return chunks.filter(Boolean).join('\n\n')
}

function extractAssistantText(message: unknown): string {
  const content = (message as any)?.content
  if (!Array.isArray(content)) return ''
  return content
    .filter(
      (item: any) => item?.type === 'text' && typeof item.text === 'string',
    )
    .map((item: any) => item.text)
    .join('')
}

export function createCursorAgentAdapter(): AiAdapter {
  async function run(
    input: AiInput,
    sessionId: string | undefined,
    options: AiRunOptions,
  ): Promise<AiResult> {
    const {
      onChunk,
      signal,
      cwd,
      model,
      attachmentOutputDir,
      forceToolExecution,
    } = options

    const imageInputDir = await mkdtemp(
      join(tmpdir(), 'discord-ai-runner-cursor-input-'),
    )

    try {
      const promptText = await buildPromptText(input, imageInputDir)
      const prompt = buildSystemPrompt(promptText, { attachmentOutputDir })

      // ヘッドレスモードは承認プロンプトを出せず、承認が必要なツール呼び出しは
      // 自動拒否される。通常は --auto-review（安全と分類された呼び出しだけ自動実行）、
      // /force 有効時は --force（明示的に拒否設定されたもの以外すべて実行）で緩和する
      const procArgs = ['-p', '--output-format', 'stream-json', '--trust']
      procArgs.push(forceToolExecution ? '--force' : '--auto-review')
      if (model) {
        procArgs.push('--model', model)
      }
      if (sessionId) {
        procArgs.push('--resume', sessionId)
      }
      procArgs.push(prompt)

      const proc = spawn(
        resolveSpawnCmd(cwd, 'cursor-agent-ws', 'cursor-agent'),
        procArgs,
        {
          cwd,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      )

      let lineBuffer = ''
      let accumulatedText = ''
      let resolvedSessionId = sessionId ?? ''
      let usageInput: number | undefined
      let usageOutput: number | undefined
      let resultText: string | null = null
      let resultError: Error | null = null

      const completed = new Promise<void>((resolve, reject) => {
        proc.on('error', (err) => {
          reject(err instanceof Error ? err : new Error(String(err)))
        })

        proc.stderr.on('data', (data: Buffer) => {
          const text = data.toString().trim()
          if (text) {
            console.error('[cursor-agent] stderr:', text)
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

            if (typeof message?.session_id === 'string') {
              resolvedSessionId = message.session_id
            }

            if (message?.type === 'assistant') {
              const text = extractAssistantText(message.message)
              if (text) {
                accumulatedText = accumulatedText
                  ? `${accumulatedText}\n\n${text}`
                  : text
                onChunk(accumulatedText)
              }
              continue
            }

            if (message?.type === 'result') {
              usageInput = message.usage?.inputTokens
              usageOutput = message.usage?.outputTokens
              if (message.is_error) {
                resultError = new Error(
                  typeof message.result === 'string'
                    ? message.result
                    : 'cursor-agent turn failed',
                )
              } else if (typeof message.result === 'string') {
                resultText = message.result
              }
            }
          }
        })

        proc.on('close', (code) => {
          if (resultError) {
            reject(resultError)
            return
          }
          if (resultText === null && !accumulatedText) {
            reject(new Error(`cursor-agent closed unexpectedly (code=${code})`))
            return
          }
          resolve()
        })
      })

      signal?.addEventListener(
        'abort',
        () => {
          proc.kill()
        },
        { once: true },
      )

      await completed

      if (signal?.aborted) {
        throw new DOMException('aborted', 'AbortError')
      }

      return {
        result: accumulatedText || resultText || '（応答なし）',
        session_id: resolvedSessionId,
        input_tokens: usageInput,
        output_tokens: usageOutput,
        attachments: await collectAttachments(attachmentOutputDir),
      }
    } finally {
      await rm(imageInputDir, { recursive: true, force: true })
    }
  }

  return {
    run,
  }
}
