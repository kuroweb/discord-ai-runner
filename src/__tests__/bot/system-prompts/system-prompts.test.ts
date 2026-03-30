import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'vitest'
import { resolveAgentToolsDir } from '../../../bot/system-prompts/agent-tools-path'
import {
  ATTACHMENT_ROOT_DIR,
  resolveAttachmentOutputDir,
} from '../../../bot/system-prompts/attachment-output'
import { renderAttachmentPolicy } from '../../../bot/system-prompts/attachment-policy'
import { renderGoogleDrivePolicy } from '../../../bot/system-prompts/google-drive-policy'
import {
  buildSystemPrompt,
  renderSystemPrompt,
} from '../../../bot/system-prompts/system-prompt'
import { renderToolingPolicy } from '../../../bot/system-prompts/tooling-policy'

const testModuleDir = dirname(fileURLToPath(import.meta.url))

test('resolveAttachmentOutputDir joins session and turn under ATTACHMENT_ROOT_DIR', () => {
  const sessionKey = 'sess-a'
  const turnId = 'turn-1'
  assert.equal(
    resolveAttachmentOutputDir(sessionKey, turnId),
    join(ATTACHMENT_ROOT_DIR, sessionKey, turnId),
  )
})

test('resolveAgentToolsDir returns undefined when package has no agent-tools dir', () => {
  const root = mkdtempSync(join(tmpdir(), 'no-tools-'))
  writeFileSync(join(root, 'package.json'), '{}')
  assert.equal(resolveAgentToolsDir(join(root, 'src')), undefined)
})

test('resolveAgentToolsDir returns absolute agent-tools path when present', () => {
  const root = mkdtempSync(join(tmpdir(), 'with-tools-'))
  writeFileSync(join(root, 'package.json'), '{}')
  mkdirSync(join(root, 'agent-tools'))
  const nested = join(root, 'packages', 'x', 'src')
  mkdirSync(nested, { recursive: true })
  assert.equal(resolveAgentToolsDir(nested), join(root, 'agent-tools'))
})

test('renderSystemPrompt composes policies in the documented order', () => {
  const options = { attachmentOutputDir: '/tmp/unit-test-attachments' }
  const agentToolsDir = resolveAgentToolsDir(testModuleDir)
  const expected = [
    renderAttachmentPolicy(options.attachmentOutputDir),
    renderGoogleDrivePolicy(),
    renderToolingPolicy(agentToolsDir),
  ]
    .filter(Boolean)
    .join('\n\n')
  assert.equal(renderSystemPrompt(options), expected)
})

test('buildSystemPrompt appends user prompt after separator', () => {
  const options = { attachmentOutputDir: '/tmp/x' }
  const system = renderSystemPrompt(options)
  assert.ok(system.length > 0)
  assert.equal(
    buildSystemPrompt('hello', options),
    `${system}\n\n---\n\nhello`,
  )
})
