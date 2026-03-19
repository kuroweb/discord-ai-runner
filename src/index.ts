import 'dotenv/config'
import { Client, GatewayIntentBits } from 'discord.js'
import { createAdapter } from './adapters'
import { registerMessageHandler } from './bot/discord-handler'
import { registerSlashCommands } from './bot/slash-commands'
import { createBotState } from './bot/state'
import { createThreadScheduler } from './bot/thread-scheduler'
import { createApprovalManager } from './bot/approval'
import { createBatchRunner, schedule } from './batch'

const DISCORD_TOKEN = process.env.DISCORD_TOKEN
if (!DISCORD_TOKEN) throw new Error('DISCORD_TOKEN が設定されていません')

const adapterName = process.env.AI_ADAPTER ?? 'claude'
const adapter = createAdapter(adapterName)
const state = createBotState('.state.json')
const scheduler = createThreadScheduler()
const approvalManager = createApprovalManager()

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
})

const batchRunner = createBatchRunner({
  client,
  adapter,
  state,
  scheduler,
  approvalManager,
})
schedule.forEach(({ cron, job, channelId }) =>
  batchRunner.register(cron, job, channelId),
)

registerMessageHandler({
  client,
  adapterName,
  adapter,
  state,
  scheduler,
  approvalManager,
})

if (process.env.BATCH_ENABLED === 'true') {
  client.once('clientReady', () => batchRunner.start())
}

client.once('clientReady', (readyClient) => {
  console.log(`✅ ${readyClient.user.tag} として起動しました`)
})

client.once('clientReady', async () => {
  try {
    await registerSlashCommands(client, DISCORD_TOKEN)
  } catch (error) {
    console.error('slash command の登録に失敗しました', error)
  }
})

state.load()
client.login(DISCORD_TOKEN)
