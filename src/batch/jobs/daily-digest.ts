import { ChannelType } from 'discord.js'
import type { AiInput } from '../../adapters/types'
import { buildThreadName } from '../../bot/messages'
import { respond } from '../../bot/respond'
import type { BatchJob } from '../types'

const DEFAULT_SUMMARY = 'AIニュース デイリーダイジェスト'

function buildDigestPrompt(): AiInput {
  const now = new Date()
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const timestamp = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(now)
    .replace(' ', 'T')

  return {
    parts: [
      {
        type: 'text',
        text: [
          'daily-digest skill を使って、AIニュースのデイリーダイジェストを作成してください。',
          `対象日は ${today} JST です。現在時刻は ${timestamp} JST です。`,
          'Discord に投稿する最終本文だけを日本語で返してください。',
        ].join('\n'),
      },
    ],
  }
}

export const dailyDigestJob: BatchJob = {
  id: 'daily-digest',
  run: async (ctx) => {
    if (!ctx.channelId) {
      console.log(
        '[batch] daily-digest: DAILY_DIGEST_CHANNEL_ID 未設定のためスキップ',
      )
      return
    }

    const channel = await ctx.client.channels.fetch(ctx.channelId)
    console.log(
      `[batch] daily-digest: channel fetch attempted (${ctx.channelId})`,
    )
    if (!channel) {
      console.warn(`[batch] daily-digest: channel not found (${ctx.channelId})`)
      return
    }

    if (
      channel.type !== ChannelType.GuildText &&
      channel.type !== ChannelType.GuildAnnouncement
    ) {
      console.warn(
        `[batch] daily-digest: unsupported channel type (${channel.type})`,
      )
      return
    }

    const kickoff = await channel.send(`🗞️ ${DEFAULT_SUMMARY}`)
    console.log('[batch] daily-digest: kickoff message sent')
    const thread = await kickoff.startThread({
      name: buildThreadName(DEFAULT_SUMMARY),
      autoArchiveDuration: 1440,
      reason: 'AIニュース デイリーダイジェスト',
    })
    console.log(`[batch] daily-digest: thread started (${thread.id})`)

    ctx.state.activateThread(thread.id, ctx.channelId)
    ctx.state.save()
    ctx.approvalManager.enableAutoApprove(thread.id)
    console.log('[batch] daily-digest: state saved')

    const signal = ctx.scheduler.abort(thread.id)
    await ctx.scheduler.enqueue(thread.id, async () => {
      await respond(thread, thread, buildDigestPrompt(), thread.id, signal, {
        adapter: ctx.adapter,
        state: ctx.state,
        approvalManager: ctx.approvalManager,
      })
    })
  },
}
