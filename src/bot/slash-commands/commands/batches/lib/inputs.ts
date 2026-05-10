import cron from 'node-cron'
import { BATCH_MESSAGE_MAX_LENGTH, BATCH_NAME_MAX_LENGTH } from './constants'

export function parseCustomIdWithPrefix(
  customId: string,
  prefix: string,
): string | null {
  if (!customId.startsWith(prefix)) return null
  const value = customId.slice(prefix.length)
  return value || null
}

export function normalizeCronInput(value: string): string {
  return value.trim()
}

export function normalizeMessageInput(value: string): string {
  return value.trim()
}

export function validateBatchJobInput({
  name,
  cronExpr,
  message,
}: {
  name: string
  cronExpr: string
  message: string
}): string | null {
  if (!name) return '❌ ジョブ名は必須です。'
  if (name.length > BATCH_NAME_MAX_LENGTH) {
    return `❌ ジョブ名が長すぎます（最大 ${BATCH_NAME_MAX_LENGTH} 文字）。`
  }
  if (!cronExpr) return '❌ cron は必須です。'
  if (!cron.validate(cronExpr)) {
    return `❌ 無効な cron 式です: \`${cronExpr}\``
  }
  if (!message) return '❌ message は空にできません。'
  if (message.length > BATCH_MESSAGE_MAX_LENGTH) {
    return `❌ message が長すぎます（最大 ${BATCH_MESSAGE_MAX_LENGTH} 文字）。`
  }
  return null
}
