import {
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type ChatInputCommandInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js'
import type { BatchJob } from '../../../../../batch'
import { resolveChannelName } from '../../../../lib/interaction'
import { BATCH_JOB_OPTION_LIMIT } from './constants'

export function buildJobSelectRow(
  customId: string,
  jobs: BatchJob[],
  guild?:
    | ChatInputCommandInteraction['guild']
    | StringSelectMenuInteraction['guild'],
): ActionRowBuilder<StringSelectMenuBuilder> {
  const options = jobs.slice(0, BATCH_JOB_OPTION_LIMIT).map((job) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(job.name.slice(0, 100))
      .setValue(job.id)
      .setDescription(
        `${job.cron} / #${resolveChannelName(guild, job.channelId)}`.slice(
          0,
          100,
        ),
      ),
  )
  const select = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('対象ジョブを選択')
    .addOptions(options)
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)
}

export function buildChannelSelectRow(
  customId: string,
): ActionRowBuilder<ChannelSelectMenuBuilder> {
  const select = new ChannelSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('投稿先チャンネルを選択')
    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
  return new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(select)
}
