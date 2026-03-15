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

type SupportedMediaType =
  | 'application/pdf'
  | 'image/gif'
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'

type AttachmentKind = 'image' | 'pdf' | 'text' | 'unsupported'

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
  return null
}

function shouldInlineAttachmentAsText(attachment: Attachment): boolean {
  const contentType = attachment.contentType?.toLowerCase()
  if (contentType?.startsWith('text/')) return true
  return Boolean(contentType && TEXT_MIME_TYPES.has(contentType))
}

function classifyAttachment(attachment: Attachment): AttachmentKind {
  const supportedMediaType = detectSupportedMediaType(attachment)
  if (
    supportedMediaType === 'image/gif' ||
    supportedMediaType === 'image/jpeg' ||
    supportedMediaType === 'image/png' ||
    supportedMediaType === 'image/webp'
  ) {
    return 'image'
  }

  if (supportedMediaType === 'application/pdf') {
    return 'pdf'
  }

  if (shouldInlineAttachmentAsText(attachment)) {
    return 'text'
  }

  return 'unsupported'
}

export function hasPdfAttachment(message: Message): boolean {
  return message.attachments.some(
    (attachment) => classifyAttachment(attachment) === 'pdf',
  )
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

  const attachmentKind = classifyAttachment(attachment)

  if (attachmentKind === 'unsupported') {
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

  if (attachmentKind === 'text') {
    return [
      {
        type: 'text',
        text: `添付ファイル: ${attachment.name}\n\n${data.toString('utf8')}`,
      },
    ]
  }

  if (attachmentKind === 'pdf') {
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

  const imageMediaType = detectSupportedMediaType(attachment)
  if (
    imageMediaType !== 'image/gif' &&
    imageMediaType !== 'image/jpeg' &&
    imageMediaType !== 'image/png' &&
    imageMediaType !== 'image/webp'
  ) {
    return [
      formatAttachmentNotice(
        `添付 ${attachment.name} の種別を判定できませんでした。`,
      ),
    ]
  }

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
