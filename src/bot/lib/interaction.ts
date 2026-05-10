import type {
  ChatInputCommandInteraction,
  StringSelectMenuInteraction,
} from 'discord.js'

export function resolveChannelName(
  guild:
    | ChatInputCommandInteraction['guild']
    | StringSelectMenuInteraction['guild']
    | undefined,
  channelId: string,
): string {
  const channel = guild?.channels.cache.get(channelId)
  if (channel && 'name' in channel && typeof channel.name === 'string') {
    return channel.name
  }
  return channelId
}
