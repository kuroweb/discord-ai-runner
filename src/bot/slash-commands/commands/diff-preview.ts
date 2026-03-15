import type { ChatInputCommandInteraction } from 'discord.js'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { resolveThreadCwd } from '../../state'
import {
  DISCORD_MAX_LENGTH,
  splitMarkdownCodeBlocksForDiscord,
} from '../../messages'
import type { CommandDependencies } from '../types'

async function runGitDiffHtmlCommand(
  cwd: string,
  options: { file?: string | null },
): Promise<{ outputPath: string; tempDir: string }> {
  const tempDir = await mkdtemp(
    resolve(tmpdir(), 'discord-ai-runner-git-diff-'),
  )
  const outputPath = resolve(tempDir, 'git-diff.html')
  const toolPath = resolve(process.cwd(), 'agent-tools/bin/diff-preview-html')
  const toolArgs = ['--output', outputPath, '--repo', cwd]

  if (options.file?.trim()) {
    toolArgs.push('--', options.file.trim())
  }

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const proc = spawn(toolPath, toolArgs, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stderr = ''
    proc.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString()
    })
    proc.on('error', rejectPromise)
    proc.on('close', (code) => {
      if (code === 0) {
        resolvePromise()
        return
      }
      rejectPromise(
        new Error(stderr.trim() || 'プレビューの生成に失敗しました。'),
      )
    })
  })

  return { outputPath, tempDir }
}

async function runGitDiffMarkdownCommand(
  cwd: string,
  options: { file?: string | null },
): Promise<string> {
  const toolPath = resolve(
    process.cwd(),
    'agent-tools/bin/diff-preview-markdown',
  )
  const toolArgs = ['--repo', cwd]
  if (options.file?.trim()) {
    toolArgs.push('--', options.file.trim())
  }

  const result = spawnSync(toolPath, toolArgs, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  })

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || 'プレビューの生成に失敗しました。')
  }
  return result.stdout ?? ''
}

export async function handleDiffPreviewHtml(
  interaction: ChatInputCommandInteraction,
  { state }: CommandDependencies,
): Promise<void> {
  await interaction.deferReply()

  let tempDir: string | null = null
  try {
    const cwd = resolveThreadCwd(state, interaction.channelId)
    const file = interaction.options.getString('file')
    const result = await runGitDiffHtmlCommand(cwd, { file })
    tempDir = result.tempDir

    await interaction.editReply({
      content: file?.trim()
        ? `📎 \`${file.trim()}\` の git diff を HTML にしました。`
        : `📎 \`${cwd}\` の git diff を HTML にしました。`,
      files: [result.outputPath],
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'プレビューの生成に失敗しました。'
    await interaction.editReply(`❌ ${message}`)
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
    }
  }
}

export async function handleDiffPreviewMarkdown(
  interaction: ChatInputCommandInteraction,
  { state }: CommandDependencies,
): Promise<void> {
  await interaction.deferReply()

  try {
    const cwd = resolveThreadCwd(state, interaction.channelId)
    const file = interaction.options.getString('file')
    const markdown = await runGitDiffMarkdownCommand(cwd, { file })
    const header = file?.trim()
      ? `📋 \`${file.trim()}\` の git diff`
      : `📋 \`${cwd}\` の git diff`
    const chunks = splitMarkdownCodeBlocksForDiscord(
      markdown,
      DISCORD_MAX_LENGTH,
      header,
    )

    await interaction.editReply({ content: chunks[0] })
    for (let i = 1; i < chunks.length; i += 1) {
      await interaction.followUp({ content: chunks[i] })
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'プレビューの生成に失敗しました。'
    await interaction.editReply(`❌ ${message}`)
  }
}
