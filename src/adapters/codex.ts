import { spawn } from 'child_process';
import type { AiAdapter, AiResult } from './types';

export function createCodexAdapter(): AiAdapter {
  async function run(
    prompt: string,
    sessionId: string | undefined,
    onChunk: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<AiResult> {
    return new Promise((resolve, reject) => {
      // 新規: codex exec --json --dangerously-bypass-approvals-and-sandbox "prompt"
      // 継続: codex exec resume <session-id> --json --dangerously-bypass-approvals-and-sandbox "prompt"
      const args = sessionId
        ? ['exec', 'resume', sessionId, '--json', '--dangerously-bypass-approvals-and-sandbox', prompt]
        : ['exec', '--json', '--dangerously-bypass-approvals-and-sandbox', prompt];

      console.log('[codex] 実行開始:', args.join(' '));
      const proc = spawn('codex', args, { stdio: ['ignore', 'pipe', 'pipe'] });

      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        proc.kill();
        reject(new DOMException('aborted', 'AbortError'));
      }, { once: true });

      let lineBuffer = '';
      let streamText = '';   // agent_message を蓄積
      let sessionIdResult = '';
      let inputTokens: number | undefined;
      let outputTokens: number | undefined;

      proc.on('error', (err) => {
        console.error('[codex] spawn エラー:', err);
        reject(err);
      });

      proc.stdout.on('data', (data: Buffer) => {
        lineBuffer += data.toString();
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            if (event.type === 'thread.started') {
              sessionIdResult = event.thread_id ?? '';
            } else if (event.type === 'item.completed' && event.item?.type === 'agent_message') {
              const text = event.item.text ?? '';
              if (text) {
                streamText += (streamText ? '\n\n' : '') + text;
                onChunk(streamText);
              }
            } else if (event.type === 'turn.completed') {
              inputTokens = event.usage?.input_tokens;
              outputTokens = event.usage?.output_tokens;
            }
          } catch {
            // JSON パース失敗は無視
          }
        }
      });

      proc.stderr.on('data', (data: Buffer) => {
        console.error('[codex] stderr:', data.toString());
      });

      const timer = setTimeout(() => {
        proc.kill();
        reject(new Error('timeout'));
      }, 300_000);

      proc.on('close', (code) => {
        clearTimeout(timer);
        console.log('[codex] 終了 code:', code);
        if (code === 0) {
          resolve({
            result: streamText,
            session_id: sessionIdResult,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
          });
        } else {
          reject(new Error(`exit code ${code}`));
        }
      });
    });
  }

  return { run };
}
