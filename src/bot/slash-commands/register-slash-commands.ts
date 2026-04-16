import { REST, Routes, type Client } from 'discord.js'
import { slashCommands } from './command-definitions'

export const registerSlashCommands = async (
  client: Client,
  token: string,
): Promise<void> => {
  const applicationId = client.application?.id
  if (!applicationId) {
    throw new Error('application id を取得できませんでした')
  }

  const rest = new REST({ version: '10' }).setToken(token)
  const route = Routes.applicationCommands(applicationId)

  await rest.put(route, { body: slashCommands })
  console.log('✅ global slash commands を登録しました')
}
