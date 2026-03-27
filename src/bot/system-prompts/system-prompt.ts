import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { renderAttachmentPolicy } from './attachment-policy'
import { renderGoogleDrivePolicy } from './google-drive-policy'
import { renderToolingPolicy } from './tooling-policy'

export const ATTACHMENT_ROOT_DIR = '/tmp/discord-ai-runner'

export interface SystemPromptOptions {
  attachmentOutputDir?: string
}

function findPackageRoot(fromDir: string): string {
  let dir = fromDir
  for (;;) {
    if (existsSync(join(dir, 'package.json'))) return dir
    const parent = dirname(dir)
    if (parent === dir) return fromDir
    dir = parent
  }
}

const AGENT_TOOLS_DIR = (() => {
  const root = findPackageRoot(__dirname)
  const dir = join(root, 'agent-tools')
  return existsSync(dir) ? dir : undefined
})()

export function resolveAttachmentOutputDir(
  sessionKey: string,
  turnId: string,
): string {
  return join(ATTACHMENT_ROOT_DIR, sessionKey, turnId)
}

export function renderSystemPrompt(options: SystemPromptOptions): string {
  const parts = [
    renderAttachmentPolicy(options.attachmentOutputDir),
    renderGoogleDrivePolicy(),
    renderToolingPolicy(AGENT_TOOLS_DIR),
  ].filter(Boolean)
  return parts.join('\n\n')
}

export function buildSystemPrompt(
  userPrompt: string,
  options: SystemPromptOptions,
): string {
  const systemPrompt = renderSystemPrompt(options)
  if (!systemPrompt) return userPrompt
  return `${systemPrompt}\n\n---\n\n${userPrompt}`
}
