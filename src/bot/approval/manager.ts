import { randomUUID } from 'crypto'
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type MessageCreateOptions,
} from 'discord.js'
import type { ToolApprovalDecision } from '../../adapters/types'
import { isHighRiskOperation } from './policy'

interface PendingApproval {
  channelId: string
  resolve: (decision: ToolApprovalDecision) => void
  timer: NodeJS.Timeout
}

export type ApprovalMessageTarget = {
  send(message: string | MessageCreateOptions): Promise<unknown>
}

const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000

function buildApprovalMessage(
  requestId: string,
  toolName: string,
  input: Record<string, unknown>,
  highRisk: boolean,
) {
  const embed = new EmbedBuilder()
    .setTitle(`🔧 ツール実行承認: ${toolName}`)
    .setColor(highRisk ? '#e74c3c' : '#f39c12')
    .setDescription(formatApprovalInput(input))
    .setFooter({
      text: highRisk
        ? '高リスク操作のため、毎回の明示承認が必要です（5分以内）'
        : '5分以内に選択してください',
    })

  const components = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`approve:${requestId}`)
        .setLabel('Approve')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`deny:${requestId}`)
        .setLabel('Deny')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`approve-all:${requestId}`)
        .setLabel('Auto-approve')
        .setStyle(ButtonStyle.Secondary),
    ),
  ]

  return { embeds: [embed], components }
}

function truncate(text: string, maxLen: number): string {
  return text.length <= maxLen ? text : `${text.slice(0, maxLen - 1)}…`
}

function formatApprovalInput(input: Record<string, unknown>): string {
  if (typeof input.command === 'string') {
    return `\`\`\`bash\n${truncate(input.command, 900)}\n\`\`\``
  }
  if (typeof input.file_path === 'string') {
    return `\`${input.file_path}\``
  }
  const serialized = JSON.stringify(input, null, 2) ?? '{}'
  return `\`\`\`json\n${truncate(serialized, 900)}\n\`\`\``
}

export function createApprovalManager() {
  const pending = new Map<string, PendingApproval>()
  const autoApproveChannels = new Set<string>()

  async function requestApproval(
    target: ApprovalMessageTarget,
    channelId: string,
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<ToolApprovalDecision> {
    const highRisk = isHighRiskOperation(toolName, input)
    if (autoApproveChannels.has(channelId) && !highRisk) return 'approve'

    const requestId = randomUUID()
    await target.send(
      buildApprovalMessage(requestId, toolName, input, highRisk),
    )

    return new Promise<ToolApprovalDecision>((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(requestId)
        resolve('deny')
      }, APPROVAL_TIMEOUT_MS)

      pending.set(requestId, {
        channelId,
        resolve: (decision) => {
          clearTimeout(timer)
          if (decision === 'approve-all') {
            autoApproveChannels.add(channelId)
          }
          resolve(decision)
        },
        timer,
      })
    })
  }

  function resolveApproval(
    requestId: string,
    decision: ToolApprovalDecision,
  ): boolean {
    const request = pending.get(requestId)
    if (!request) return false
    pending.delete(requestId)
    clearTimeout(request.timer)
    request.resolve(decision)
    return true
  }

  function clearAutoApprove(channelId: string): void {
    autoApproveChannels.delete(channelId)
  }

  return {
    requestApproval,
    resolveApproval,
    clearAutoApprove,
  }
}
