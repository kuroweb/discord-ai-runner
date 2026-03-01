export interface AiResult {
  result: string;
  session_id: string;
}

export interface AiAdapter {
  run(
    prompt: string,
    sessionId: string | undefined,
    onChunk: (text: string) => void,
  ): Promise<AiResult>;
}
