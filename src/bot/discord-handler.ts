import type { Client } from 'discord.js';
import type { AiAdapter } from '../adapters';
import {
  buildThreadName,
  formatStatus,
} from './messages';
import { respond } from './respond';
import type { createBotState } from './state';
import type { createThreadTaskManager } from './thread-task-manager';

interface HandlerDependencies {
  client: Client;
  adapter: AiAdapter;
  state: ReturnType<typeof createBotState>;
  taskManager: ReturnType<typeof createThreadTaskManager>;
}

export function registerMessageHandler(dependencies: HandlerDependencies): void {
  const { client, adapter, state, taskManager } = dependencies;

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const channel = message.channel;

    if (state.isActiveThread(channel.id)) {
      const prompt = message.content.trim();
      if (!prompt) return;

      if (prompt === '!reset') {
        taskManager.nextRevision(channel.id);
        state.clearSession(channel.id);
        state.save();
        await message.channel.send('セッションをリセットしました。');
        return;
      }

      if (prompt === '!status') {
        const usage = state.getUsage(channel.id);
        if (!usage) {
          await message.channel.send('（このセッションはまだ利用データがありません）');
          return;
        }
        await message.channel.send(formatStatus(usage));
        return;
      }

      const revision = taskManager.nextRevision(channel.id);
      await taskManager.enqueue(channel.id, async () => {
        await respond(
          { send: (content: string) => message.channel.send(content) },
          prompt,
          channel.id,
          revision,
          { adapter, state, taskManager },
        );
      });
      return;
    }

    if (!message.mentions.has(client.user!)) return;

    const prompt = message.content.replace(/<[@#][!&]?\d+>/g, '').trim();
    if (!prompt) return;

    if (prompt === '!status') {
      await message.channel.send('スレッド内で `!status` を送ってください。');
      return;
    }

    const thread = await message.startThread({
      name: buildThreadName(prompt),
      autoArchiveDuration: 1440,
    });

    state.activateThread(thread.id);
    const revision = taskManager.nextRevision(thread.id);
    state.save();

    await taskManager.enqueue(thread.id, async () => {
      await respond(thread, prompt, thread.id, revision, { adapter, state, taskManager });
    });
  });
}
