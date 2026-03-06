import 'dotenv/config';
import { Client, Intents } from 'discord.js';
import { createAdapter } from './adapters';
import { registerMessageHandler } from './bot/discord-handler';
import { createBotState } from './bot/state';
import { createThreadTaskManager } from './bot/thread-task-manager';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) throw new Error('DISCORD_TOKEN が設定されていません');

const adapterName = process.env.AI_ADAPTER ?? 'claude';
const adapter = createAdapter(adapterName);
const state = createBotState('.state.json');
const taskManager = createThreadTaskManager();

const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.MESSAGE_CONTENT,
  ],
});

registerMessageHandler({ client, adapter, state, taskManager });

client.once('ready', (readyClient) => {
  console.log(`✅ ${readyClient.user.tag} として起動しました`);
});

state.load();
client.login(DISCORD_TOKEN);
