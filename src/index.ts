import 'dotenv/config';
import { Client, Intents, Message } from 'discord.js';
import { readFileSync, writeFileSync } from 'fs';
import { createAdapter, isClaudeResult, type AiResult, type ClaudeResult } from './adapters';
import { createWsBroadcaster, type WsBroadcaster } from './ws';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) throw new Error('DISCORD_TOKEN が設定されていません');

const DISCORD_MAX_LENGTH = 2000;
const DISCORD_THREAD_NAME_MAX_LENGTH = 100;
const EDIT_INTERVAL_MS = 1500;
const STATE_FILE = '.state.json';

const adapter = createAdapter(process.env.AI_ADAPTER ?? 'claude');
const ws: WsBroadcaster = (() => {
  try {
    return createWsBroadcaster();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[ws] disabled: ${msg}`);
    return {
      sendStreamStarted: () => {},
      sendStreamPartial: () => {},
      sendStreamCompleted: () => {},
      sendStreamError: () => {},
    };
  }
})();

const sessions = new Map<string, string>();      // threadId → session_id
const activeThreads = new Set<string>();         // bot が管理するスレッドの ID
const threadQueues = new Map<string, Promise<void>>();
const threadRevisions = new Map<string, number>();

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

function nextThreadRevision(threadId: string): number {
  const next = (threadRevisions.get(threadId) ?? 0) + 1;
  threadRevisions.set(threadId, next);
  return next;
}

function isCurrentRevision(threadId: string, revision: number): boolean {
  return (threadRevisions.get(threadId) ?? 0) === revision;
}

async function enqueueThreadTask(threadId: string, task: () => Promise<void>): Promise<void> {
  const prev = threadQueues.get(threadId) ?? Promise.resolve();
  const run = prev
    .catch(() => {})
    .then(task);

  threadQueues.set(
    threadId,
    run.finally(() => {
      if (threadQueues.get(threadId) === run) {
        threadQueues.delete(threadId);
      }
    }),
  );

  await run;
}

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

function asQuote(text: string): string {
  return text
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n');
}

function buildProgressMessage(elapsedMs: number, latestText: string): string {
  const elapsedSec = Math.floor(elapsedMs / 1000);
  if (!latestText) return `[処理中] ${elapsedSec}s 経過`;
  return `[処理中] ${elapsedSec}s 経過\n\n${latestText}`;
}

function buildCompletedMessage(text: string): string {
  if (!text.trim()) return '[完了] （応答なし）';
  return `[完了]\n\n${text}`;
}

function buildFailedMessage(message: string): string {
  return `[失敗] ${message}`;
}

function buildThreadName(): string {
  const now = new Date().toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `CodexBot ${now}`.slice(0, DISCORD_THREAD_NAME_MAX_LENGTH);
}

async function respond(
  sendTarget: { send(content: string): Promise<Message> },
  prompt: string,
  sessionKey: string,
  revision: number,
  requestId: string,
): Promise<void> {
  if (!isCurrentRevision(sessionKey, revision)) {
    ws.sendStreamError(sessionKey, requestId, 'stale_request', { fatal: false });
    return;
  }

  const sessionId = sessions.get(sessionKey);
  const thinking = await sendTarget.send('[処理中] 開始します');

  let latestText = '';
  let dirty = false;
  const startedAt = Date.now();
  let lastRenderedSec = -1;

  const interval = setInterval(async () => {
    if (!isCurrentRevision(sessionKey, revision)) {
      ws.sendStreamError(sessionKey, requestId, 'replaced_by_newer_request', {
        fatal: false,
        elapsedMs: Date.now() - startedAt,
      });
      clearInterval(interval);
      return;
    }

    const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
    if (!dirty && elapsedSec === lastRenderedSec) return;
    dirty = false;
    lastRenderedSec = elapsedSec;
    try {
      await thinking.edit(truncate(buildProgressMessage(Date.now() - startedAt, latestText)));
    } catch {}
  }, EDIT_INTERVAL_MS);

  try {
    ws.sendStreamStarted(sessionKey, requestId, { sessionId });
    await thinking.edit(buildProgressMessage(Date.now() - startedAt, latestText));
    const result = await adapter.run(prompt, sessionId, (text) => {
      if (!isCurrentRevision(sessionKey, revision)) return;
      const prev = latestText;
      latestText = text;
      dirty = true;
      const delta = text.startsWith(prev) ? text.slice(prev.length) : text;
      if (delta) {
        ws.sendStreamPartial(sessionKey, requestId, delta);
      }
    });

    clearInterval(interval);

    if (!isCurrentRevision(sessionKey, revision)) {
      ws.sendStreamError(sessionKey, requestId, 'replaced_after_response', {
        fatal: false,
        elapsedMs: Date.now() - startedAt,
      });
      await thinking.edit('[中断] 新しいメッセージまたはリセットにより、この応答は破棄されました');
      return;
    }

    if (result.session_id) {
      sessions.set(sessionKey, result.session_id);
      saveState();
    }
    threadUsage.set(sessionKey, result);

    await thinking.edit(truncate(buildCompletedMessage(result.result)));
    ws.sendStreamCompleted(sessionKey, requestId, result.result, Date.now() - startedAt);
  } catch (err) {
    clearInterval(interval);
    const msg = err instanceof Error ? err.message : String(err);
    await thinking.edit(truncate(buildFailedMessage(msg)));
    ws.sendStreamError(sessionKey, requestId, msg, {
      fatal: true,
      elapsedMs: Date.now() - startedAt,
    });
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
      nextThreadRevision(channel.id);
      sessions.delete(channel.id);
      threadUsage.delete(channel.id);
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

    const revision = nextThreadRevision(channel.id);
    const requestId = `${channel.id}:${revision}`;
    await enqueueThreadTask(channel.id, async () => {
      await respond(channel as { send(content: string): Promise<Message> }, prompt, channel.id, revision, requestId);
    });
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

  const thread = await message.startThread({
    name: buildThreadName(),
    autoArchiveDuration: 1440,
  });

  activeThreads.add(thread.id);
  const revision = nextThreadRevision(thread.id);
  const requestId = `${thread.id}:${revision}`;
  saveState();
  await thread.send(truncate(`初回要望:\n${asQuote(prompt)}`));
  await enqueueThreadTask(thread.id, async () => {
    await respond(thread, prompt, thread.id, revision, requestId);
  });
});

client.once('ready', (c) => {
  console.log(`✅ ${c.user.tag} として起動しました`);
});

loadState();
client.login(DISCORD_TOKEN);
