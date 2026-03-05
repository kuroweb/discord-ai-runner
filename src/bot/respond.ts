import type { Message } from 'discord.js';
import type { AiAdapter } from '../adapters';
import type { createBotState } from './state';
import type { createThreadTaskManager } from './thread-task-manager';
import {
  buildCompletedMessage,
  buildFailedMessage,
  buildInterruptedMessage,
  buildProgressMessage,
  truncate,
} from './messages';

const EDIT_INTERVAL_MS = 1500;

export interface SendTarget {
  send(content: string): Promise<Message>;
}

interface RespondDependencies {
  adapter: AiAdapter;
  state: ReturnType<typeof createBotState>;
  taskManager: ReturnType<typeof createThreadTaskManager>;
}

export async function respond(
  sendTarget: SendTarget,
  prompt: string,
  sessionKey: string,
  revision: number,
  dependencies: RespondDependencies,
): Promise<void> {
  const { adapter, state, taskManager } = dependencies;

  if (!taskManager.isCurrentRevision(sessionKey, revision)) {
    return;
  }

  const sessionId = state.getSession(sessionKey);
  const thinking = await sendTarget.send('🔄処理中開始します');

  let latestText = '';
  let dirty = false;
  const startedAt = Date.now();
  let lastRenderedSec = -1;
  const abortController = new AbortController();

  const interval = setInterval(async () => {
    if (!taskManager.isCurrentRevision(sessionKey, revision)) {
      clearInterval(interval);
      return;
    }

    const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
    if (!dirty && elapsedSec === lastRenderedSec) return;

    dirty = false;
    lastRenderedSec = elapsedSec;

    try {
      await thinking.edit(truncate(buildProgressMessage(Date.now() - startedAt, latestText)));
    } catch {
      // 編集失敗は無視
    }
  }, EDIT_INTERVAL_MS);

  try {
    await thinking.edit(buildProgressMessage(Date.now() - startedAt, latestText));

    const result = await adapter.run(prompt, sessionId, (text) => {
      if (!taskManager.isCurrentRevision(sessionKey, revision)) {
        abortController.abort();
        return;
      }
      latestText = text;
      dirty = true;
    }, abortController.signal);

    clearInterval(interval);

    if (!taskManager.isCurrentRevision(sessionKey, revision)) {
      await thinking.edit(truncate(buildInterruptedMessage(latestText)));
      return;
    }

    if (result.session_id) {
      state.setSession(sessionKey, result.session_id);
      state.save();
    }
    state.setUsage(sessionKey, result);

    await thinking.edit(truncate(buildCompletedMessage(result.result)));
  } catch (error) {
    clearInterval(interval);
    if (error instanceof DOMException && error.name === 'AbortError') {
      await thinking.edit(truncate(buildInterruptedMessage(latestText)));
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    await thinking.edit(truncate(buildFailedMessage(message)));
  }
}
