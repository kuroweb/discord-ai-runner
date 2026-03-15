import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { query } from '@anthropic-ai/claude-agent-sdk'
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js'
import type { CommandDependencies } from './types'

const execFileAsync = promisify(execFile)
const OPENAI_MODELS_LIST_CLI = resolve(
  process.cwd(),
  'agent-tools/bin/openai-models-list',
)
const MODELS_PAGE_SIZE = 25

async function fetchClaudeRemoteModelIds(): Promise<string[]> {
  const queryInstance = query({
    prompt: 'List available models.',
    options: {
      permissionMode: 'bypassPermissions',
    },
  }) as any

  try {
    const models = (await queryInstance.supportedModels()) as Array<{
      value?: unknown
    }>
    return models
      .map((model) => (typeof model.value === 'string' ? model.value.trim() : ''))
      .filter(Boolean)
  } finally {
    queryInstance.close()
  }
}

async function fetchRemoteModelIds(): Promise<string[]> {
  const adapterName = (process.env.AI_ADAPTER ?? 'claude').trim().toLowerCase()
  if (adapterName === 'claude') {
    return fetchClaudeRemoteModelIds()
  }

  const { stdout, stderr } = await execFileAsync(OPENAI_MODELS_LIST_CLI, ['--json'], {
    cwd: process.cwd(),
    env: process.env,
    maxBuffer: 1024 * 1024 * 8,
  })
  if (stderr.trim()) {
    throw new Error(stderr.trim())
  }
  const payload = JSON.parse(stdout) as { data?: Array<{ id?: unknown }> }
  return (payload.data ?? [])
    .map((model) => (typeof model.id === 'string' ? model.id.trim() : ''))
    .filter(Boolean)
}

function buildRemoteModelsView(
  models: string[],
  page: number,
  currentModel: string | undefined,
): {
  content: string
  components: [
    ActionRowBuilder<StringSelectMenuBuilder>,
    ActionRowBuilder<ButtonBuilder>,
  ]
} {
  const totalPages = Math.max(1, Math.ceil(models.length / MODELS_PAGE_SIZE))
  const safePage = Math.min(Math.max(page, 0), totalPages - 1)
  const start = safePage * MODELS_PAGE_SIZE
  const pageModels = models.slice(start, start + MODELS_PAGE_SIZE)

  const select = new StringSelectMenuBuilder()
    .setCustomId('model-select')
    .setPlaceholder('モデルを選択してこのスレッドに設定')
    .addOptions(
      pageModels.map((modelId) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(modelId.slice(0, 100))
          .setValue(modelId)
          .setDefault(modelId === currentModel),
      ),
    )

  const prevButton = new ButtonBuilder()
    .setCustomId(`model-remote-page:prev:${safePage}`)
    .setLabel('Prev')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(safePage <= 0)

  const nextButton = new ButtonBuilder()
    .setCustomId(`model-remote-page:next:${safePage}`)
    .setLabel('Next')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(safePage >= totalPages - 1)

  const content = currentModel
    ? `🤖 現在のモデル: \`${currentModel}\`\nリモートモデル (${models.length}件) Page ${safePage + 1}/${totalPages}`
    : `🤖 リモートモデル (${models.length}件) Page ${safePage + 1}/${totalPages}`

  return {
    content,
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
      new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton),
    ],
  }
}

function parseRemotePageCustomId(customId: string): {
  direction: 'prev' | 'next'
  page: number
} | null {
  const match = /^model-remote-page:(prev|next):(\d+)$/.exec(customId)
  if (!match) return null
  return {
    direction: match[1] as 'prev' | 'next',
    page: Number(match[2]),
  }
}

export async function handleListModelsRemote(
  interaction: ChatInputCommandInteraction,
  { state }: Pick<CommandDependencies, 'state'>,
): Promise<void> {
  await interaction.deferReply()

  try {
    const models = await fetchRemoteModelIds()

    if (models.length === 0) {
      await interaction.editReply('🤖 利用可能なモデルはありません。')
      return
    }

    const currentModel = state.getThreadModel(interaction.channelId)
    const view = buildRemoteModelsView(models, 0, currentModel)
    await interaction.editReply(view)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'モデル一覧の取得に失敗しました。'
    await interaction.editReply(`❌ ${message}`)
  }
}

export async function handleRemoteModelPageButton(
  interaction: ButtonInteraction,
  { state }: Pick<CommandDependencies, 'state'>,
): Promise<boolean> {
  const parsed = parseRemotePageCustomId(interaction.customId)
  if (!parsed) return false

  try {
    const models = await fetchRemoteModelIds()
    if (models.length === 0) {
      await interaction.update({ content: '🤖 利用可能なモデルはありません。', components: [] })
      return true
    }

    const nextPage =
      parsed.direction === 'next' ? parsed.page + 1 : parsed.page - 1
    const currentModel = state.getThreadModel(interaction.channelId)
    const view = buildRemoteModelsView(models, nextPage, currentModel)
    await interaction.update(view)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'モデル一覧の取得に失敗しました。'
    await interaction.update({ content: `❌ ${message}`, components: [] })
  }

  return true
}

export async function handleModelSelect(
  interaction: StringSelectMenuInteraction,
  { state, scheduler, approvalManager }: CommandDependencies,
): Promise<void> {
  const threadId = interaction.channelId
  const model = interaction.values[0]
  if (!model) return

  scheduler.abort(threadId)
  state.setThreadModel(threadId, model)
  approvalManager.clearAutoApprove(threadId)
  state.save()

  await interaction.update({
    content: `🤖 モデルを \`${model}\` に設定しました。次の応答から使用します。`,
    components: [],
  })
}

export async function handleModel(
  interaction: ChatInputCommandInteraction,
  { state, scheduler, approvalManager }: CommandDependencies,
): Promise<void> {
  const model = interaction.options.getString('id', true).trim()
  if (!model) {
    await interaction.reply({
      content: '❌ model id は空にできません。',
      flags: ['Ephemeral'],
    })
    return
  }

  const threadId = interaction.channelId
  scheduler.abort(threadId)
  state.setThreadModel(threadId, model)
  approvalManager.clearAutoApprove(threadId)
  state.save()

  await interaction.reply(
    `🤖 モデルを \`${model}\` に設定しました。次の応答から使用します。`,
  )
}
