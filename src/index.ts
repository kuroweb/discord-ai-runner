import 'dotenv/config';
import { Client, Intents } from 'discord.js';
import { spawn } from 'child_process';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) throw new Error('DISCORD_TOKEN が設定されていません');

const DISCORD_MAX_LENGTH = 2000;
const EDIT_INTERVAL_MS = 1500;

// チャンネル ID → session_id のマップ（メモリのみ）
const sessions = new Map<string, string>();

interface ClaudeResult {
  result: string;
  session_id: string;
}

function runClaude(
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
            finalResult = {
              result: event.result ?? accumulated,
              session_id: event.session_id ?? '',
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
        resolve(finalResult ?? { result: accumulated, session_id: '' });
      } else {
        reject(new Error(`exit code ${code}`));
      }
    });
  });
}

function truncate(text: string): string {
  return text.length > DISCORD_MAX_LENGTH
    ? text.slice(0, DISCORD_MAX_LENGTH - 10) + '\n…(省略)'
    : text;
}

const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.MESSAGE_CONTENT,
  ],
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.mentions.has(client.user!)) return;

  const prompt = message.content.replace(/<@!?\d+>/g, '').trim();
  if (!prompt) return;

  const channelId = message.channelId;
  const sessionId = sessions.get(channelId);
  const thinking = await message.reply('thinking...');

  let latestText = '';
  let dirty = false;

  const interval = setInterval(async () => {
    if (!dirty || !latestText) return;
    dirty = false;
    try {
      await thinking.edit(truncate(latestText));
    } catch {}
  }, EDIT_INTERVAL_MS);

  try {
    const { result, session_id } = await runClaude(prompt, sessionId, (text) => {
      latestText = text;
      dirty = true;
    });

    clearInterval(interval);

    if (session_id) {
      sessions.set(channelId, session_id);
      console.log('[claude] session_id:', session_id);
    }

    await thinking.edit(truncate(result) || '（応答なし）');
  } catch (err) {
    clearInterval(interval);
    const msg = err instanceof Error ? err.message : String(err);
    await thinking.edit(`エラー: ${msg}`);
  }
});

client.once('ready', (c) => {
  console.log(`✅ ${c.user.tag} として起動しました`);
});

client.login(DISCORD_TOKEN);
