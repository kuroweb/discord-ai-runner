import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { spawnSync, type SpawnSyncReturns } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { html as renderDiffHtml } from 'diff2html'

const require = createRequire(import.meta.url)
const diff2htmlCssPath =
  require.resolve('diff2html/bundles/css/diff2html.min.css')

type OutputFormat = 'line-by-line' | 'side-by-side'

interface CliOptions {
  output: string
  repo?: string
  format: OutputFormat
  diffArgs: string[]
  help?: boolean
}

function printHelp(): void {
  console.log(`git-diff-html

Render git diff output to a standalone HTML file.

Usage:
  git-diff-html [options] [-- <git diff args...>]

Options:
  -o, --output <path>                         Output HTML path (default: ./git-diff.html)
  --repo <path>                              Working directory for git diff (default: git repo root)
  --format <line-by-line|side-by-side>       diff2html output format (default: line-by-line)
  -h, --help                                 Show this help
`)
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    output: 'git-diff.html',
    format: 'line-by-line',
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
    if (arg === '-o' || arg === '--output') {
      index += 1
      options.output = argv[index] ?? ''
      continue
    }
    if (arg === '--repo') {
      index += 1
      options.repo = argv[index] ?? ''
      continue
    }
    if (arg === '--format') {
      index += 1
      const format = argv[index]
      if (format === 'line-by-line' || format === 'side-by-side') {
        options.format = format
        continue
      }
      throw new Error('--format must be line-by-line or side-by-side')
    }
    throw new Error(`Unknown argument: ${arg}`)
  }

  if (!options.output) throw new Error('Missing value for --output')
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

async function buildDocument(
  diffText: string,
  format: OutputFormat,
): Promise<string> {
  const css = await readFile(diff2htmlCssPath, 'utf8')
  const renderedDiffHtml = renderDiffHtml(diffText, {
    drawFileList: true,
    matching: 'lines',
    outputFormat: format,
  })
  const diffHtml = renderedDiffHtml
    .replaceAll('d2h-light-color-scheme', 'd2h-dark-color-scheme')
    .replaceAll('d2h-auto-color-scheme', 'd2h-dark-color-scheme')

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>git diff</title>
    <style>
      ${css}
      html {
        background: #0d1117;
      }
    </style>
  </head>
  <body>
    ${diffText.trim() ? diffHtml : ''}
  </body>
</html>`
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  const outputPath = resolve(options.output)
  const repoPath = resolveRepoPath(options.repo)
  const diffText = collectDiffText(repoPath, options.diffArgs)
  const document = await buildDocument(diffText, options.format)

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, document, 'utf8')
  console.log(outputPath)
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
