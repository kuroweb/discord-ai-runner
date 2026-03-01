import { spawn } from 'child_process';
import type { AiAdapter, AiResult } from './types';

export class CodexAdapter implements AiAdapter {
  run(
    prompt: string,
    sessionId: string | undefined,
    onChunk: (text: string) => void,
  ): Promise<AiResult> {
    return new Promise((resolve, reject) => {
      // 新規: codex exec --json --dangerously-bypass-approvals-and-sandbox "prompt"
      // 継続: codex exec resume <session-id> --json --dangerously-bypass-approvals-and-sandbox "prompt"
      const args = sessionId
        ? ['exec', 'resume', sessionId, '--json', '--dangerously-bypass-approvals-and-sandbox', prompt]
        : ['exec', '--json', '--dangerously-bypass-approvals-and-sandbox', prompt];

      console.log('[codex] 実行開始:', args.join(' '));
      const proc = spawn('codex', args, { stdio: ['ignore', 'pipe', 'pipe'] });

      let lineBuffer = '';
      let streamText = '';   // 途中の agent_message を蓄積（onChunk 用）
      let finalText = '';    // task_complete.last_agent_message
      let sessionIdResult = '';

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

            if (event.type === 'session_meta') {
              sessionIdResult = event.payload?.id ?? '';
            } else if (event.type === 'event_msg') {
              const p = event.payload ?? {};
              if (p.type === 'agent_message' && p.message) {
                streamText += (streamText ? '\n\n' : '') + p.message;
                onChunk(streamText);
              } else if (p.type === 'task_complete' && p.last_agent_message) {
                finalText = p.last_agent_message;
                onChunk(finalText);
              }
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
      }, 120_000);

      proc.on('close', (code) => {
        clearTimeout(timer);
        console.log('[codex] 終了 code:', code);
        if (code === 0) {
          resolve({
            result: finalText || streamText,
            session_id: sessionIdResult,
          });
        } else {
          reject(new Error(`exit code ${code}`));
        }
      });
    });
  }
}
