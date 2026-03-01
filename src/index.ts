import 'dotenv/config';
import { Client, Intents, Message } from 'discord.js';
import { spawn } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) throw new Error('DISCORD_TOKEN が設定されていません');

const DISCORD_MAX_LENGTH = 2000;
const EDIT_INTERVAL_MS = 1500;
const STATE_FILE = '.state.json';

const sessions = new Map<string, string>();      // threadId → session_id
const activeThreads = new Set<string>();         // bot が管理するスレッドの ID

interface State {
  activeThreads: string[];
  sessions: Record<string, string>;
}

function loadState(): void {
  try {
    const data = readFileSync(STATE_FILE, 'utf-8');
    const state: State = JSON.parse(data);
    (state.activeThreads ?? []).forEach(id => activeThreads.add(id));
    Object.entries(state.sessions ?? {}).forEach(([k, v]) => sessions.set(k, v));
    console.log(`[state] 復元: threads=${activeThreads.size}, sessions=${sessions.size}`);
  } catch {
    // ファイルが存在しない場合は無視
  }
}

function saveState(): void {
  const state: State = {
    activeThreads: [...activeThreads],
    sessions: Object.fromEntries(sessions),
  };
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
interface ClaudeResult {
  result: string;
  session_id: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  context_window: number;
  duration_api_ms: number;
}

// threadId → 最新のターン情報（コンテキスト使用率は累積ではなく最新値）
const threadUsage = new Map<string, ClaudeResult>();

function formatStatus(r: ClaudeResult): string {
  const usedPct = r.context_window > 0
    ? ((r.input_tokens / r.context_window) * 100).toFixed(1)
    : '0.0';
  const latency = (r.duration_api_ms / 1000).toFixed(1);

  return [
    '```',
    `Current Session  (${r.model})`,
    `  Context : ${r.input_tokens.toLocaleString()} / ${r.context_window.toLocaleString()} tokens (${usedPct}% used)`,
    `  Output  : ${r.output_tokens.toLocaleString()} tokens`,
    `  Latency : ${latency}s`,
    '```',
  ].join('\n');
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

function truncate(text: string): string {
  return text.length > DISCORD_MAX_LENGTH
    ? text.slice(0, DISCORD_MAX_LENGTH - 10) + '\n…(省略)'
    : text;
}

async function respond(
  sendTarget: { send(content: string): Promise<Message> },
  prompt: string,
  sessionKey: string,
): Promise<void> {
  const sessionId = sessions.get(sessionKey);
  const thinking = await sendTarget.send('thinking...');

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
    const claudeResult = await runClaude(prompt, sessionId, (text) => {
      latestText = text;
      dirty = true;
    });

    clearInterval(interval);

    if (claudeResult.session_id) {
      sessions.set(sessionKey, claudeResult.session_id);
      saveState();
    }
    threadUsage.set(sessionKey, claudeResult);

    await thinking.edit(truncate(claudeResult.result) || '（応答なし）');
  } catch (err) {
    clearInterval(interval);
    const msg = err instanceof Error ? err.message : String(err);
    await thinking.edit(`エラー: ${msg}`);
  }
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

  const channel = message.channel;

  // アクティブなスレッド内のメッセージ（メンション不要）
  if (activeThreads.has(channel.id)) {
    const prompt = message.content.trim();
    if (!prompt) return;

    if (prompt === '!reset') {
      sessions.delete(channel.id);
      saveState();
      await message.reply('セッションをリセットしました。');
      return;
    }

    if (prompt === '/status') {
      const stat = threadUsage.get(channel.id);
      if (!stat) {
        await message.reply('（このセッションはまだ利用データがありません）');
        return;
      }
      await message.reply(formatStatus(stat));
      return;
    }

    await respond(channel as { send(content: string): Promise<Message> }, prompt, channel.id);
    return;
  }

  // チャンネルでの @mention → スレッドを作成して応答
  if (!message.mentions.has(client.user!)) return;

  const prompt = message.content.replace(/<@!?\d+>/g, '').trim();
  if (!prompt) return;

  if (prompt === '/status') {
    await message.reply('スレッド内で `/status` を送ってください。');
    return;
  }

  const now = new Date().toLocaleString('ja-JP', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const thread = await message.startThread({
    name: `Claude ${now}`,
    autoArchiveDuration: 1440,
  });

  activeThreads.add(thread.id);
  saveState();
  await respond(thread, prompt, thread.id);
});

client.once('ready', (c) => {
  console.log(`✅ ${c.user.tag} として起動しました`);
});

loadState();
client.login(DISCORD_TOKEN);
