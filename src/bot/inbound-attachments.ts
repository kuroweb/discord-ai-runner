import { extname } from 'node:path'
import type { Attachment, Message } from 'discord.js'
import type { AiInput, AiInputPart } from '../adapters/types'

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024

const TEXT_MIME_TYPES = new Set([
  'application/json',
  'application/ld+json',
  'application/javascript',
  'application/typescript',
  'application/x-typescript',
  'application/xml',
  'application/yaml',
  'application/x-yaml',
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/xml',
  'text/html',
])

const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.json',
  '.jsonl',
  '.yml',
  '.yaml',
  '.xml',
  '.csv',
  '.log',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.rb',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.scala',
  '.swift',
  '.php',
  '.sh',
  '.zsh',
  '.bash',
  '.sql',
  '.html',
  '.css',
  '.scss',
  '.toml',
  '.ini',
  '.env',
])

type SupportedMediaType =
  | 'application/pdf'
  | 'image/gif'
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'

type SupportedImageMediaType = Exclude<
  SupportedMediaType,
  'application/pdf'
>

function detectSupportedMediaType(
  attachment: Attachment,
): SupportedMediaType | null {
  const contentType = attachment.contentType?.toLowerCase()
  if (
    contentType === 'application/pdf' ||
    contentType === 'image/gif' ||
    contentType === 'image/jpeg' ||
    contentType === 'image/png' ||
    contentType === 'image/webp'
  ) {
    return contentType
  }

  const ext = extname(attachment.name).toLowerCase()
  if (ext === '.pdf') return 'application/pdf'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.png') return 'image/png'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.webp') return 'image/webp'
  return null
}

function isTextAttachment(attachment: Attachment): boolean {
  const contentType = attachment.contentType?.toLowerCase()
  if (contentType?.startsWith('text/')) return true
  if (contentType && TEXT_MIME_TYPES.has(contentType)) return true
  return TEXT_EXTENSIONS.has(extname(attachment.name).toLowerCase())
}

function formatAttachmentNotice(message: string): AiInputPart {
  return { type: 'text', text: message }
}

async function fetchAttachmentData(attachment: Attachment): Promise<Buffer> {
  const response = await fetch(attachment.url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`)
  }
  const bytes = await response.arrayBuffer()
  return Buffer.from(bytes)
}

async function resolveAttachmentPart(attachment: Attachment): Promise<AiInputPart[]> {
  if (attachment.size > MAX_ATTACHMENT_BYTES) {
    return [
      formatAttachmentNotice(
        `添付 ${attachment.name} はサイズ超過のため未読込です (${attachment.size} bytes)。`,
      ),
    ]
  }

  const supportedMediaType = detectSupportedMediaType(attachment)
  const shouldReadAsText = isTextAttachment(attachment)

  if (!supportedMediaType && !shouldReadAsText) {
    return [
      formatAttachmentNotice(
        `添付 ${attachment.name} (${attachment.contentType ?? 'unknown'}) がありました。必要なら内容確認手順を指示してください。`,
      ),
    ]
  }

  let data: Buffer
  try {
    data = await fetchAttachmentData(attachment)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return [
      formatAttachmentNotice(
        `添付 ${attachment.name} の取得に失敗しました: ${message}`,
      ),
    ]
  }

  if (shouldReadAsText && !supportedMediaType) {
    return [
      {
        type: 'text',
        text: `添付ファイル: ${attachment.name}\n\n${data.toString('utf8')}`,
      },
    ]
  }

  if (supportedMediaType === 'application/pdf') {
    return [
      {
        type: 'pdf',
        filename: attachment.name,
        mediaType: 'application/pdf',
        data,
        size: data.byteLength,
      },
    ]
  }

  if (!supportedMediaType) {
    return [
      formatAttachmentNotice(
        `添付 ${attachment.name} の種別を判定できませんでした。`,
      ),
    ]
  }

  const imageMediaType: SupportedImageMediaType = supportedMediaType

  return [
    {
      type: 'image',
      filename: attachment.name,
      mediaType: imageMediaType,
      data,
      size: data.byteLength,
    },
  ]
}

export async function buildAiInputFromMessage(
  message: Message,
  options?: { content?: string },
): Promise<AiInput> {
  const parts: AiInputPart[] = []
  const text = (options?.content ?? message.content).trim()

  if (text) {
    parts.push({ type: 'text', text })
  }

  for (const attachment of message.attachments.values()) {
    parts.push(...(await resolveAttachmentPart(attachment)))
  }

  if (parts.length === 0) {
    parts.push({ type: 'text', text: '新規要望' })
  }

  return { parts }
}

export function summarizeAiInput(input: AiInput): string {
  const textPart = input.parts.find(
    (part): part is Extract<AiInputPart, { type: 'text' }> => part.type === 'text',
  )
  if (textPart?.text.trim()) return textPart.text.trim()

  const fileSummary = input.parts
    .filter((part) => part.type !== 'text')
    .map((part) => part.filename)
    .join(', ')

  return fileSummary || '新規要望'
}
