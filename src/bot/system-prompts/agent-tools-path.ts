import { existsSync } from 'fs'
import { dirname, join } from 'path'

function findPackageRoot(fromDir: string): string {
  let dir = fromDir
  for (;;) {
    if (existsSync(join(dir, 'package.json'))) return dir
    const parent = dirname(dir)
    if (parent === dir) return fromDir
    dir = parent
  }
}

export function resolveAgentToolsDir(fromDir: string): string | undefined {
  const root = findPackageRoot(fromDir)
  const dir = join(root, 'agent-tools')
  return existsSync(dir) ? dir : undefined
}
