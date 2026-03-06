import { spawn } from 'child_process';
import type { AiAdapter, AiRunOptions } from '../types';
import type { ClaudeResult } from './types';
import { buildClaudeArgs } from './args';
import { appendAssistantText, buildResultFromEvent } from './events';

const EXEC_TIMEOUT_MS = 300_000;

export function createClaudeAdapter(): AiAdapter {
  async function run(
    prompt: string,
    sessionId: string | undefined,
    options: AiRunOptions,
  ): Promise<ClaudeResult> {
    const { onChunk, signal } = options;

    return new Promise((resolve, reject) => {
      const args = buildClaudeArgs(sessionId, prompt);
      console.log('[claude] 実行開始:', args.join(' '));

      const proc = spawn('claude', args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let lineBuffer = '';
      let accumulated = '';
      let finalResult: ClaudeResult | null = null;
      let settled = false;

      const settleReject = (error: Error): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      };

      signal?.addEventListener('abort', () => {
        proc.kill();
        settleReject(new DOMException('aborted', 'AbortError'));
      }, { once: true });

      proc.on('error', (err) => {
        console.error('[claude] spawn エラー:', err);
        settleReject(err);
      });

      proc.stdout.on('data', (data: Buffer) => {
        lineBuffer += data.toString();
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            accumulated = appendAssistantText(event, accumulated, onChunk);

            const result = buildResultFromEvent(event, accumulated);
            if (result) finalResult = result;
          } catch {
            // JSON パース失敗は無視
          }
        }
      });

      proc.stderr.on('data', (data: Buffer) => {
        console.error('[claude] stderr:', data.toString());
      });

      const timer = setTimeout(() => {
        proc.kill();
        settleReject(new Error('timeout'));
      }, EXEC_TIMEOUT_MS);

      proc.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        console.log('[claude] 終了 code:', code);

        if (code === 0) {
          resolve(finalResult ?? {
            result: accumulated,
            session_id: '',
            model: '',
            input_tokens: 0,
            output_tokens: 0,
            context_window: 0,
            duration_api_ms: 0,
          });
          return;
        }
        reject(new Error(`exit code ${code}`));
      });
    });
  }

  return { run };
}
