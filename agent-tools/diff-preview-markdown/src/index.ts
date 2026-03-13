import { spawnSync, type SpawnSyncReturns } from 'node:child_process'
import process from 'node:process'
import { resolve } from 'node:path'

interface CliOptions {
  repo?: string
  diffArgs: string[]
  help?: boolean
}

function printHelp(): void {
  console.log(`diff-preview-markdown

Render git diff output as markdown (stdout) for Discord.

Usage:
  diff-preview-markdown [options] [-- <git diff args...>]

Options:
  --repo <path>    Working directory for git diff (default: git repo root)
  -h, --help       Show this help
`)
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    diffArgs: [],
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--') {
      options.diffArgs = argv.slice(index + 1)
      break
    }
    if (arg === '-h' || arg === '--help') {
      options.help = true
      continue
    }
    if (arg === '--repo') {
      index += 1
      options.repo = argv[index ?? '']
      continue
    }
    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

function runGit(args: string[], cwd: string): SpawnSyncReturns<string> {
  return spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
  })
}

function resolveRepoPath(repo?: string): string {
  if (repo) return resolve(repo)
  const result = runGit(['rev-parse', '--show-toplevel'], process.cwd())
  if (result.status !== 0) {
    throw new Error(
      result.stderr.trim() || 'Failed to resolve git repository root',
    )
  }
  return result.stdout.trim()
}

function runGitDiff(repo: string, diffArgs: string[]): string {
  const result = runGit(['diff', ...diffArgs], repo)
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || 'git diff failed')
  }
  return result.stdout
}

function listUntrackedFiles(repo: string): string[] {
  const result = runGit(['ls-files', '--others', '--exclude-standard'], repo)
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || 'Failed to list untracked files')
  }
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function renderUntrackedDiff(repo: string, filePath: string): string {
  const result = runGit(
    ['diff', '--no-index', '--no-ext-diff', '--', '/dev/null', filePath],
    repo,
  )
  if (result.status !== 1) {
    throw new Error(
      result.stderr.trim() || `Failed to render untracked diff for ${filePath}`,
    )
  }
  return result.stdout
}

function collectDiffText(repo: string, diffArgs: string[]): string {
  const trackedDiff = runGitDiff(repo, diffArgs)
  if (diffArgs.length > 0) return trackedDiff

  const untrackedDiffs = listUntrackedFiles(repo)
    .map((filePath) => renderUntrackedDiff(repo, filePath))
    .filter(Boolean)

  return [trackedDiff, ...untrackedDiffs].filter(Boolean).join('\n')
}

function main(): void {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  const repoPath = resolveRepoPath(options.repo)
  const diffText = collectDiffText(repoPath, options.diffArgs)

  if (!diffText.trim()) {
    process.stdout.write('```diff\n(変更なし)\n```\n')
    return
  }

  process.stdout.write('```diff\n')
  process.stdout.write(diffText.trimEnd())
  process.stdout.write('\n```\n')
}

main()
