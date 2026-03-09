import { randomUUID } from 'crypto'
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type TextBasedChannel,
} from 'discord.js'
import type { ToolApprovalDecision } from '../adapters/types'

interface PendingApproval {
  channelId: string
  resolve: (decision: ToolApprovalDecision) => void
  timer: NodeJS.Timeout
}

const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000
const HIGH_RISK_BASH_PATTERNS: RegExp[] = [
  /\brm\s+-rf\b/i,
  /\bsudo\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bcurl\b[\s\S]*\|\s*(?:sh|bash|zsh)\b/i,
  /\bchmod\s+777\b/i,
]

function truncate(text: string, maxLen: number): string {
  return text.length <= maxLen ? text : `${text.slice(0, maxLen - 1)}…`
}

function summarizeInput(input: Record<string, unknown>): string {
  if (typeof input.command === 'string') {
    return `\`\`\`bash\n${truncate(input.command, 900)}\n\`\`\``
  }
  if (typeof input.file_path === 'string') {
    return `\`${input.file_path}\``
  }
  const serialized = JSON.stringify(input, null, 2) ?? '{}'
  return `\`\`\`json\n${truncate(serialized, 900)}\n\`\`\``
}

function isHighRiskOperation(
  toolName: string,
  input: Record<string, unknown>,
): boolean {
  if (toolName === 'Bash') {
    const command = typeof input.command === 'string' ? input.command : ''
    return HIGH_RISK_BASH_PATTERNS.some((pattern) => pattern.test(command))
  }

  if (toolName === 'Edit') {
    const reason = typeof input.reason === 'string' ? input.reason : ''
    const grantRoot = input.grantRoot
    return (
      Boolean(grantRoot) || /\bdelete\b|\boverwrite\b|\brename\b/i.test(reason)
    )
  }

  return false
}

export function createApprovalManager() {
  const pending = new Map<string, PendingApproval>()
  const autoApproveChannels = new Set<string>()

  async function requestApproval(
    channel: TextBasedChannel,
    channelId: string,
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<ToolApprovalDecision> {
    const highRisk = isHighRiskOperation(toolName, input)
    if (autoApproveChannels.has(channelId) && !highRisk) return 'approve'

    const requestId = randomUUID()
    const embed = new EmbedBuilder()
      .setTitle(`🔧 ツール実行承認: ${toolName}`)
      .setColor(highRisk ? '#e74c3c' : '#f39c12')
      .setDescription(summarizeInput(input))
      .setFooter({
        text: highRisk
          ? '高リスク操作のため、毎回の明示承認が必要です（5分以内）'
          : '5分以内に選択してください',
      })

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
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
    )

    await channel.send({ embeds: [embed], components: [row] })

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
