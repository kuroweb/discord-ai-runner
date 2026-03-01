import { spawn } from 'child_process';
import type { AiAdapter, AiResult } from './types';

export interface ClaudeResult extends AiResult {
  model: string;
  input_tokens: number;
  output_tokens: number;
  context_window: number;
  duration_api_ms: number;
}

export function isClaudeResult(r: AiResult): r is ClaudeResult {
  return 'model' in r;
}

export class ClaudeAdapter implements AiAdapter {
  run(
    prompt: string,
    sessionId: string | undefined,
    onChunk: (text: string) => void,
  ): Promise<ClaudeResult> {
    return new Promise((resolve, reject) => {
      const args = sessionId
        ? ['--resume', sessionId, '-p', prompt, '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions']
        : ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions'];

      console.log('[claude] 実行開始:', args.join(' '));
      const proc = spawn('claude', args, { stdio: ['ignore', 'pipe', 'pipe'] });

      let lineBuffer = '';
      let accumulated = '';
      let finalResult: ClaudeResult | null = null;

      proc.on('error', (err) => {
        console.error('[claude] spawn エラー:', err);
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

            if (event.type === 'assistant') {
              const content = event.message?.content;
              if (Array.isArray(content)) {
                for (const block of content) {
                  if (block.type === 'text') {
                    accumulated += block.text;
                    onChunk(accumulated);
                  }
                }
              }
            } else if (event.type === 'result') {
              const modelKey = Object.keys(event.modelUsage ?? {})[0] ?? '';
              const modelData = event.modelUsage?.[modelKey] ?? {};
              const totalInput = (event.usage?.input_tokens ?? 0)
                + (event.usage?.cache_read_input_tokens ?? 0)
                + (event.usage?.cache_creation_input_tokens ?? 0);
              finalResult = {
                result: event.result ?? accumulated,
                session_id: event.session_id ?? '',
                model: modelKey,
                input_tokens: totalInput,
                output_tokens: event.usage?.output_tokens ?? 0,
                context_window: modelData.contextWindow ?? 0,
                duration_api_ms: event.duration_api_ms ?? 0,
              };
            }
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
        reject(new Error('timeout'));
      }, 120_000);

      proc.on('close', (code) => {
        clearTimeout(timer);
        console.log('[claude] 終了 code:', code);
        if (code === 0) {
          resolve(finalResult ?? { result: accumulated, session_id: '', model: '', input_tokens: 0, output_tokens: 0, context_window: 0, duration_api_ms: 0 });
        } else {
          reject(new Error(`exit code ${code}`));
        }
      });
    });
  }
}
