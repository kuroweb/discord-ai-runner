export function buildClaudeArgs(sessionId: string | undefined, prompt: string): string[] {
  const dangerousArgs = ['--dangerously-skip-permissions'];
  if (sessionId) {
    return ['--resume', sessionId, ...dangerousArgs, '-p', prompt, '--output-format', 'stream-json', '--verbose'];
  }
  return [...dangerousArgs, '-p', prompt, '--output-format', 'stream-json', '--verbose'];
}
