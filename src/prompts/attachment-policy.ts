import { readFileSync } from 'fs'
import { dirname, join } from 'path'

const attachmentPolicyTemplate = readFileSync(
  join(dirname(__filename), 'attachment-policy.md'),
  'utf-8',
)

export function renderAttachmentPolicy(
  attachmentOutputDir: string | undefined,
): string {
  if (!attachmentOutputDir) return ''
  return attachmentPolicyTemplate
    .replace('{{attachmentOutputDir}}', attachmentOutputDir)
    .trim()
}
