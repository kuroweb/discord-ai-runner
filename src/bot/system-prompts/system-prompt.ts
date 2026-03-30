import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { renderAttachmentPolicy } from './attachment-policy'
import { renderGoogleDrivePolicy } from './google-drive-policy'
import { resolveAgentToolsDir } from './agent-tools-path'
import { renderToolingPolicy } from './tooling-policy'

const systemPromptModuleDir = dirname(fileURLToPath(import.meta.url))

export interface SystemPromptOptions {
  attachmentOutputDir?: string
}

export function renderSystemPrompt(options: SystemPromptOptions): string {
  const agentToolsDir = resolveAgentToolsDir(systemPromptModuleDir)
  const parts = [
    renderAttachmentPolicy(options.attachmentOutputDir),
    renderGoogleDrivePolicy(),
    renderToolingPolicy(agentToolsDir),
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
