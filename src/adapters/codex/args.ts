export function buildCodexArgs(sessionId: string | undefined, prompt: string): string[] {
  const dangerousArgs = ['--dangerously-bypass-approvals-and-sandbox'];
  if (sessionId) {
    return [...dangerousArgs, 'exec', 'resume', sessionId, '--json', prompt];
  }
  return [...dangerousArgs, 'exec', '--json', prompt];
}
