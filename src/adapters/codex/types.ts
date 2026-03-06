export interface CodexRunState {
  streamText: string;
  sessionIdResult: string;
  inputTokens?: number;
  outputTokens?: number;
}

export function createInitialRunState(): CodexRunState {
  return {
    streamText: '',
    sessionIdResult: '',
  };
}
