export function buildClaudeArgs(sessionId: string | undefined, prompt: string): string[] {
  const permissionArgs = ['--permission-mode', 'default'];
  if (sessionId) {
    return ['--resume', sessionId, ...permissionArgs, '-p', prompt, '--output-format', 'stream-json', '--verbose'];
  }
  return [...permissionArgs, '-p', prompt, '--output-format', 'stream-json', '--verbose'];
}
