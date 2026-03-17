import { ChannelType } from 'discord.js'
import type { AiInput } from '../../adapters/types'
import { splitIntoChunks, buildThreadName } from '../../bot/messages'
import {
  resolveChannelDefaultCwd,
  resolveChannelDefaultModel,
} from '../../bot/state'
import type { BatchJob } from '../types'

const DEFAULT_SUMMARY = 'AIニュース デイリーダイジェスト'

function buildDigestPrompt(): AiInput {
  const today = new Date().toISOString().slice(0, 10)

  return {
    parts: [
      {
        type: 'text',
        text: [
          'Use these skill files as primary instructions:',
          '- Claude: .claude/skills/daily-digest.md',
          '- Codex: .codex/skills/daily-digest.md',
          'Choose the one that matches the current adapter runtime.',
          `Generate AI news daily digest for ${today}.`,
          'Output format:',
          '- First non-empty line: one-line summary in Japanese (for thread title, plain text).',
          '- After a blank line: detailed digest in Japanese Markdown.',
        ].join('\n'),
      },
    ],
  }
}

function extractSummary(text: string): string {
  const firstLine =
    text
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? ''

  const normalized = firstLine.replace(/^[-*#>\d.)\s]+/, '').trim()
  return normalized || DEFAULT_SUMMARY
}

function extractBody(text: string): string {
  const lines = text.split('\n')
  const firstNonEmptyIndex = lines.findIndex((line) => line.trim().length > 0)
  if (firstNonEmptyIndex === -1) return DEFAULT_SUMMARY

  const body = lines
    .slice(firstNonEmptyIndex + 1)
    .join('\n')
    .trim()
  if (!body) return text.trim() || DEFAULT_SUMMARY
  return body
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

    const result = await ctx.adapter.run(buildDigestPrompt(), undefined, {
      cwd: resolveChannelDefaultCwd(ctx.state, ctx.channelId),
      model: resolveChannelDefaultModel(ctx.state, ctx.channelId),
      onChunk: () => {},
    })

    const summary = extractSummary(result.result)
    const body = extractBody(result.result)

    const kickoff = await channel.send(`🗞️ ${summary}`)
    const thread = await kickoff.startThread({
      name: buildThreadName(summary),
      autoArchiveDuration: 1440,
      reason: 'AIニュース デイリーダイジェスト',
    })

    for (const chunk of splitIntoChunks(body)) {
      await thread.send(chunk)
    }

    ctx.state.activateThread(thread.id, ctx.channelId)
    if (result.session_id) {
      ctx.state.setSession(thread.id, result.session_id)
    }
    ctx.state.save()
  },
}
