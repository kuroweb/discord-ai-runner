export interface AiResult {
  result: string;
  session_id: string;
  input_tokens?: number;
  output_tokens?: number;
}

export interface AiRunOptions {
  onChunk: (text: string) => void;
  signal?: AbortSignal;
}

export interface AiAdapter {
  run(
    prompt: string,
    sessionId: string | undefined,
    options: AiRunOptions,
  ): Promise<AiResult>;
}
