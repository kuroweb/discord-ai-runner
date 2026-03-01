import 'dotenv/config';
import { Client, Intents, Message } from 'discord.js';
import { readFileSync, writeFileSync } from 'fs';
import { createAdapter, isClaudeResult, type AiResult, type ClaudeResult } from './adapters';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) throw new Error('DISCORD_TOKEN が設定されていません');

const DISCORD_MAX_LENGTH = 2000;
const EDIT_INTERVAL_MS = 1500;
const STATE_FILE = '.state.json';

const adapter = createAdapter(process.env.AI_ADAPTER ?? 'claude');

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

const threadUsage = new Map<string, AiResult>();

function formatStatus(r: AiResult): string {
  if (isClaudeResult(r)) {
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

  return [
    '```',
    `  Input  : ${r.input_tokens?.toLocaleString() ?? '?'} tokens`,
    `  Output : ${r.output_tokens?.toLocaleString() ?? '?'} tokens`,
    '```',
  ].join('\n');
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
    const result = await adapter.run(prompt, sessionId, (text) => {
      latestText = text;
      dirty = true;
    });

    clearInterval(interval);

    if (result.session_id) {
      sessions.set(sessionKey, result.session_id);
      saveState();
    }
    threadUsage.set(sessionKey, result);

    await thinking.edit(truncate(result.result) || '（応答なし）');
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
