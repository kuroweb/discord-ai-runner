export function buildCodexArgs(sessionId: string | undefined, prompt: string): string[] {
  const safeArgs = ['-a', 'on-request', '-s', 'workspace-write'];
  if (sessionId) {
    return [...safeArgs, 'exec', 'resume', sessionId, '--json', prompt];
  }
  return [...safeArgs, 'exec', '--json', prompt];
}
