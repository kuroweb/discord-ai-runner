import { basename, relative, resolve } from 'path'
import { readdir, stat } from 'fs/promises'
import type { AiAttachment } from './types'

const MAX_ATTACHMENTS = 25
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024

async function walkFiles(
  rootDir: string,
  currentDir: string,
): Promise<string[]> {
  let entries
  try {
    entries = await readdir(currentDir, { withFileTypes: true })
  } catch {
    return []
  }
  const files: string[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue

    const nextPath = resolve(currentDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(rootDir, nextPath)))
      continue
    }
    if (!entry.isFile()) continue

    const rel = relative(rootDir, nextPath)
    if (rel.startsWith('..')) continue
    files.push(nextPath)
  }

  return files
}

export async function collectAttachments(
  outputDir: string | undefined,
): Promise<AiAttachment[]> {
  if (!outputDir) return []

  const rootDir = resolve(outputDir)
  const filePaths = (await walkFiles(rootDir, rootDir)).slice(
    0,
    MAX_ATTACHMENTS,
  )
  const attachments: AiAttachment[] = []

  for (const filePath of filePaths) {
    const info = await stat(filePath)
    if (!info.isFile()) continue
    if (info.size > MAX_ATTACHMENT_BYTES) continue

    attachments.push({
      path: filePath,
      name: basename(filePath),
      size: info.size,
    })
  }

  return attachments
}
