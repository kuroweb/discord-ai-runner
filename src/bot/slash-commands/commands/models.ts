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
import {
  resolveChannelDefaultModel,
  resolveThreadModel,
} from '../../state'
import type { CommandDependencies } from '../types'

const MODELS_PAGE_SIZE = 25
const CODEX_SELECTOR_MODEL_PREFIXES = ['gpt-5.']

const ANTHROPIC_MODELS_URL = 'https://api.anthropic.com/v1/models'
const ANTHROPIC_VERSION = '2023-06-01'
const OPENAI_MODELS_URL = 'https://api.openai.com/v1/models'

interface AnthropicModelInfo {
  id: string
  created_at?: string
  display_name?: string
  type?: string
}

interface AnthropicModelsResponse {
  data?: AnthropicModelInfo[]
  last_id?: string
  has_more?: boolean
}

async function fetchClaudeRemoteModelIds(): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_MODELS_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('ANTHROPIC_MODELS_API_KEY が設定されていません。')
  }

  const modelIds: string[] = []
  let afterId: string | undefined

  do {
    const url = new URL(ANTHROPIC_MODELS_URL)
    url.searchParams.set('limit', '1000')
    if (afterId) {
      url.searchParams.set('after_id', afterId)
    }

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'anthropic-version': ANTHROPIC_VERSION,
        'x-api-key': apiKey,
      },
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(
        `Anthropic Models API エラー (${res.status}): ${text || res.statusText}`,
      )
    }

    const body = (await res.json()) as AnthropicModelsResponse
    const data = body.data ?? []
    for (const m of data) {
      if (m.id?.trim()) {
        modelIds.push(m.id.trim())
      }
    }

    afterId = body.has_more ? body.last_id : undefined
  } while (afterId)

  return modelIds
}

async function fetchOpenAIRemoteModelIds(
  prefixes?: string[],
): Promise<string[]> {
  const apiKey = process.env.OPENAI_MODELS_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('OPENAI_MODELS_API_KEY が設定されていません。')
  }

  const res = await fetch(OPENAI_MODELS_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(
      `OpenAI Models API エラー (${res.status}): ${text || res.statusText}`,
    )
  }

  const body = (await res.json()) as { data?: Array<{ id?: unknown }> }
  const allIds = (body.data ?? [])
    .map((model) => (typeof model.id === 'string' ? model.id.trim() : ''))
    .filter(Boolean)

  if (!prefixes || prefixes.length === 0) {
    return allIds.sort()
  }

  return allIds
    .filter((id) => prefixes.some((prefix) => id.startsWith(prefix)))
    .sort()
}

async function fetchRemoteModelIds(): Promise<string[]> {
  const adapterName = (process.env.AI_ADAPTER ?? 'claude').trim().toLowerCase()
  if (adapterName === 'claude') {
    return fetchClaudeRemoteModelIds()
  }

  if (adapterName === 'codex') {
    return fetchOpenAIRemoteModelIds(CODEX_SELECTOR_MODEL_PREFIXES)
  }

  return fetchOpenAIRemoteModelIds()
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

  const currentModelLabel = currentModel
    ? `\`${currentModel}\``
    : '未固定（アダプタのデフォルトを使用）'
  const content = `🤖 現在のモデル: ${currentModelLabel}\nリモートモデル (${models.length}件) Page ${safePage + 1}/${totalPages}`

  return {
    content,
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        prevButton,
        nextButton,
      ),
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

    const channelId = interaction.channelId
    const currentModel = state.isActiveThread(channelId)
      ? resolveThreadModel(state, channelId)
      : resolveChannelDefaultModel(state, channelId)
    const view = buildRemoteModelsView(models, 0, currentModel)
    await interaction.editReply(view)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'モデル一覧の取得に失敗しました。'
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
      await interaction.update({
        content: '🤖 利用可能なモデルはありません。',
        components: [],
      })
      return true
    }

    const nextPage =
      parsed.direction === 'next' ? parsed.page + 1 : parsed.page - 1
    const channelId = interaction.channelId
    const currentModel = state.isActiveThread(channelId)
      ? resolveThreadModel(state, channelId)
      : resolveChannelDefaultModel(state, channelId)
    const view = buildRemoteModelsView(models, nextPage, currentModel)
    await interaction.update(view)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'モデル一覧の取得に失敗しました。'
    await interaction.update({ content: `❌ ${message}`, components: [] })
  }

  return true
}

export async function handleModelSelect(
  interaction: StringSelectMenuInteraction,
  { state, scheduler, approvalManager }: CommandDependencies,
): Promise<void> {
  const model = interaction.values[0]
  if (!model) return

  const channelId = interaction.channelId
  const isManagedThread = state.isActiveThread(channelId)
  const isThread = interaction.channel?.isThread() ?? false

  if (!isManagedThread && isThread) {
    await interaction.reply({
      content:
        'このスレッドは bot の管理対象ではありません。通常チャンネルで実行するとデフォルトモデルを設定できます。',
      flags: ['Ephemeral'],
    })
    return
  }

  if (!isManagedThread) {
    state.setChannelModel(channelId, model)
    state.save()
    await interaction.update({
      content: `🤖 このチャンネルのデフォルトモデルを \`${model}\` に設定しました。新しく作成されるスレッドと、このデフォルトを継承しているスレッドで使用されます。`,
      components: [],
    })
    return
  }

  scheduler.abort(channelId)
  state.setThreadModel(channelId, model)
  approvalManager.clearAutoApprove(channelId)
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
  const channelId = interaction.channelId
  const isManagedThread = state.isActiveThread(channelId)
  const isThread = interaction.channel?.isThread() ?? false
  const model = interaction.options.getString('id')

  if (!isManagedThread && isThread) {
    await interaction.reply({
      content:
        'このスレッドは bot の管理対象ではありません。通常チャンネルで実行するとデフォルトモデルを表示または設定できます。',
      flags: ['Ephemeral'],
    })
    return
  }

  if (!model) {
    const content = isManagedThread
      ? `🤖 現在のモデル: \`${resolveThreadModel(state, channelId) ?? '未固定（アダプタのデフォルトを使用）'}\``
      : `🤖 このチャンネルのデフォルトモデル: \`${resolveChannelDefaultModel(state, channelId) ?? '未固定（アダプタのデフォルトを使用）'}\``
    await interaction.reply(content)
    return
  }

  const normalizedModel = model.trim()
  if (!normalizedModel) {
    await interaction.reply({
      content: '❌ model id は空にできません。',
      flags: ['Ephemeral'],
    })
    return
  }

  if (isManagedThread) {
    if (resolveThreadModel(state, channelId) === normalizedModel) {
      await interaction.reply(
        `🤖 このスレッドのモデルはすでに \`${normalizedModel}\` です。`,
      )
      return
    }
    scheduler.abort(channelId)
    state.setThreadModel(channelId, normalizedModel)
    approvalManager.clearAutoApprove(channelId)
    state.save()
    await interaction.reply(
      `🤖 このスレッドのモデルを \`${normalizedModel}\` に設定しました。次の応答から使用します。`,
    )
    return
  }

  if (resolveChannelDefaultModel(state, channelId) === normalizedModel) {
    await interaction.reply(
      `🤖 このチャンネルのデフォルトモデルはすでに \`${normalizedModel}\` です。`,
    )
    return
  }

  state.setChannelModel(channelId, normalizedModel)
  state.save()
  await interaction.reply(
    `🤖 このチャンネルのデフォルトモデルを \`${normalizedModel}\` に設定しました。新しく作成されるスレッドと、このデフォルトを継承しているスレッドで使用されます。`,
  )
}
