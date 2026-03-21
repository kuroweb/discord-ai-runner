import { existsSync } from 'fs'
import { join } from 'path'

/**
 * `<cwd>/bin/<binScript>` があればそのパス。なければ fallbackCommand（標準コマンドや SDK の command など）。
 */
export function resolveSpawnCmd(
  cwd: string,
  binScript: string,
  fallbackCommand: string,
): string {
  const wrapper = join(cwd, 'bin', binScript)
  return existsSync(wrapper) ? wrapper : fallbackCommand
}
