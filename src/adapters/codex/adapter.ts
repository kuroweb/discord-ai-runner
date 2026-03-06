import { spawn } from 'child_process';
import type { AiAdapter, AiRunOptions, AiResult } from '../types';
import { buildCodexArgs } from './args';
import {
  applyCodexEvent,
  toAiResult,
} from './events';
import { createInitialRunState } from './types';

const EXEC_TIMEOUT_MS = 300_000;

export function createCodexAdapter(): AiAdapter {
  async function run(
    prompt: string,
    sessionId: string | undefined,
    options: AiRunOptions,
  ): Promise<AiResult> {
    const { onChunk, signal } = options;

    return new Promise<AiResult>((resolve, reject) => {
      const args = buildCodexArgs(sessionId, prompt);
      console.log('[codex] 実行開始:', args.join(' '));

      const proc = spawn('codex', args, { stdio: ['pipe', 'pipe', 'pipe'] });
      let lineBuffer = '';
      const state = createInitialRunState();

      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        proc.kill();
        reject(new DOMException('aborted', 'AbortError'));
      }, { once: true });

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
            applyCodexEvent(event, state, onChunk);
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
      }, EXEC_TIMEOUT_MS);

      proc.on('close', (code) => {
        clearTimeout(timer);
        console.log('[codex] 終了 code:', code);
        if (code === 0) {
          resolve(toAiResult(state));
        } else {
          reject(new Error(`exit code ${code}`));
        }
      });
    });
  }

  return { run };
}
