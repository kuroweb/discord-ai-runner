import type { Client } from 'discord.js';
import type { AiAdapter } from '../adapters';
import {
  buildThreadName,
  formatStatus,
} from './messages';
import { respond } from './respond';
import type { createBotState } from './state';
import type { createThreadTaskManager } from './thread-task-manager';
import type { createApprovalManager } from './approval-manager';

interface HandlerDependencies {
  client: Client;
  adapter: AiAdapter;
  state: ReturnType<typeof createBotState>;
  taskManager: ReturnType<typeof createThreadTaskManager>;
  approvalManager: ReturnType<typeof createApprovalManager>;
}

export function registerMessageHandler(dependencies: HandlerDependencies): void {
  const {
    client,
    adapter,
    state,
    taskManager,
    approvalManager,
  } = dependencies;

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const raw = interaction.customId;
    const idx = raw.indexOf(':');
    const action = idx === -1 ? raw : raw.slice(0, idx);
    const requestId = idx === -1 ? '' : raw.slice(idx + 1);
    if (!requestId) return;

    let decision: 'approve' | 'deny' | 'approve-all';
    if (action === 'approve') {
      decision = 'approve';
    } else if (action === 'deny') {
      decision = 'deny';
    } else if (action === 'approve-all') {
      decision = 'approve-all';
    } else {
      return;
    }

    const resolved = approvalManager.resolveApproval(requestId, decision);
    if (!resolved) {
      await interaction.reply({
        content: 'この承認リクエストは期限切れです。',
        ephemeral: true,
      });
      return;
    }

    const messages: Record<typeof decision, string> = {
      approve: '✅ 承認しました',
      deny: '❌ 拒否しました',
      'approve-all': '⚡ このスレッドの自動承認を有効化しました',
    };

    await interaction.update({
      content: messages[decision],
      embeds: [],
      components: [],
    });
  });

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const channel = message.channel;

    if (state.isActiveThread(channel.id)) {
      const prompt = message.content.trim();
      if (!prompt) return;

      if (prompt === '!reset') {
        taskManager.nextRevision(channel.id);
        state.clearSession(channel.id);
        approvalManager.clearAutoApprove(channel.id);
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
          message.channel,
          prompt,
          channel.id,
          revision,
          {
            adapter,
            state,
            taskManager,
            approvalManager,
          },
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
      await respond(
        thread,
        thread,
        prompt,
        thread.id,
        revision,
        {
          adapter,
          state,
          taskManager,
          approvalManager,
        },
      );
    });
  });
}
