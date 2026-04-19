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

export const createApprovalManager = () => {
  const pending = new Map<string, PendingApproval>()
  const autoApproveChannels = new Set<string>()

  const requestApproval = async (
    target: ApprovalMessageTarget,
    channelId: string,
    toolName: string,
    input: Record<string, unknown>,
    abortController: AbortController,
  ): Promise<ToolApprovalDecision> => {
    const signal = abortController.signal
    const highRisk = isHighRiskOperation(toolName, input)
    if (autoApproveChannels.has(channelId) && !highRisk) return 'approve'

    const requestId = randomUUID()
    await target.send(
      buildApprovalMessage(requestId, toolName, input, highRisk),
    )

    return new Promise<ToolApprovalDecision>((resolve) => {
      let settled = false
      const settle = (decision: ToolApprovalDecision): void => {
        if (settled) return
        settled = true
        resolve(decision)
      }
      const timer = setTimeout(() => {
        pending.delete(requestId)
        abortController.abort()
        settle('deny')
      }, APPROVAL_TIMEOUT_MS)
      if (signal.aborted) {
        clearTimeout(timer)
        settle('deny')
        return
      }
      const handleAbort = () => {
        pending.delete(requestId)
        clearTimeout(timer)
        settle('deny')
      }
      signal.addEventListener('abort', handleAbort, { once: true })

      pending.set(requestId, {
        channelId,
        resolve: (decision) => {
          signal.removeEventListener('abort', handleAbort)
          clearTimeout(timer)
          if (decision === 'approve-all') {
            autoApproveChannels.add(channelId)
          }
          settle(decision)
        },
        timer,
      })
    })
  }

  const resolveApproval = (
    requestId: string,
    decision: ToolApprovalDecision,
  ): boolean => {
    const request = pending.get(requestId)
    if (!request) return false
    pending.delete(requestId)
    clearTimeout(request.timer)
    request.resolve(decision)
    return true
  }

  const clearAutoApprove = (channelId: string): void => {
    autoApproveChannels.delete(channelId)
  }

  const enableAutoApprove = (channelId: string): void => {
    autoApproveChannels.add(channelId)
  }

  return {
    requestApproval,
    resolveApproval,
    clearAutoApprove,
    enableAutoApprove,
  }
}

const buildApprovalMessage = (
  requestId: string,
  toolName: string,
  input: Record<string, unknown>,
  highRisk: boolean,
): {
  embeds: EmbedBuilder[]
  components: ActionRowBuilder<ButtonBuilder>[]
} => {
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

const truncate = (text: string, maxLen: number): string => {
  return text.length <= maxLen ? text : `${text.slice(0, maxLen - 1)}…`
}

const formatApprovalInput = (input: Record<string, unknown>): string => {
  if (typeof input.command === 'string') {
    return `\`\`\`bash\n${truncate(input.command, 900)}\n\`\`\``
  }
  if (typeof input.file_path === 'string') {
    return `\`${input.file_path}\``
  }
  const serialized = JSON.stringify(input, null, 2) ?? '{}'
  return `\`\`\`json\n${truncate(serialized, 900)}\n\`\`\``
}
