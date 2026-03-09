import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { createAdapter } from './adapters';
import { registerMessageHandler } from './bot/discord-handler';
import { createBotState } from './bot/state';
import { createThreadTaskManager } from './bot/thread-task-manager';
import { createApprovalManager } from './bot/approval-manager';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) throw new Error('DISCORD_TOKEN が設定されていません');

const adapterName = process.env.AI_ADAPTER ?? 'claude';
const adapter = createAdapter(adapterName);
const state = createBotState('.state.json');
const taskManager = createThreadTaskManager();
const approvalManager = createApprovalManager();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

registerMessageHandler({
  client,
  adapter,
  state,
  taskManager,
  approvalManager,
});

client.once('clientReady', (readyClient) => {
  console.log(`✅ ${readyClient.user.tag} として起動しました`);
});

state.load();
client.login(DISCORD_TOKEN);
