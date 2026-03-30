import { join } from 'path'

export const ATTACHMENT_ROOT_DIR = '/tmp/discord-ai-runner'

export function resolveAttachmentOutputDir(
  sessionKey: string,
  turnId: string,
): string {
  return join(ATTACHMENT_ROOT_DIR, sessionKey, turnId)
}
