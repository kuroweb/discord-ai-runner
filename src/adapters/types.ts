export interface AiResult {
  result: string;
  session_id: string;
  input_tokens?: number;
  output_tokens?: number;
}

export interface AiAdapter {
  run(
    prompt: string,
    sessionId: string | undefined,
    onChunk: (text: string) => void,
  ): Promise<AiResult>;
}
