import { loadConfig, getEnabledBackends, type AIBackend } from '../config/manager.js'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatResponse {
  text: string
  backend: string
  model: string
  tokens?: number
}

export interface EnsembleMember {
  backend: string
  model: string
  text: string
  tokens?: number
  ok: boolean
  error?: string
}

export interface EnsembleResponse {
  final: ChatResponse
  members: EnsembleMember[]
  strategy: 'single' | 'ensemble-3'
}

async function callBackend(backend: AIBackend, messages: ChatMessage[]): Promise<ChatResponse> {
  const endpoint = backend.endpoint ?? 'https://api.openai.com/v1'
  const model = backend.model ?? 'gpt-4-turbo'
  const apiKey = backend.apiKey ?? ''

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    throw new Error(`Backend ${backend.name} returned ${response.status}`)
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>
    usage?: { total_tokens?: number }
  }

  const text = data.choices[0]?.message?.content ?? ''
  if (!text.trim()) {
    throw new Error(`Backend ${backend.name} returned empty response`)
  }

  return {
    text,
    backend: backend.name,
    model,
    tokens: data.usage?.total_tokens,
  }
}

function pickEnsembleBackends(
  all: AIBackend[],
  requestedNames: string[] | undefined,
  count: number
): AIBackend[] {
  const max = Math.max(2, Math.min(3, count))
  if (requestedNames && requestedNames.length > 0) {
    const byName = new Map(all.map((b) => [b.name, b]))
    const picked = requestedNames.map((n) => byName.get(n)).filter((b): b is AIBackend => Boolean(b)).slice(0, max)
    if (picked.length >= 2) return picked
  }
  return all.slice(0, max)
}

export async function routeChatOnBackend(backendName: string, messages: ChatMessage[]): Promise<ChatResponse> {
  const config = loadConfig()
  const backend = getEnabledBackends(config).find((b) => b.name === backendName)
  if (!backend) {
    return {
      text: `Backend ${backendName} is not enabled.`,
      backend: 'error',
      model: 'none',
    }
  }

  try {
    return await callBackend(backend, messages)
  } catch (err) {
    return {
      text: `Backend ${backendName} failed: ${err instanceof Error ? err.message : String(err)}`,
      backend: 'error',
      model: 'none',
    }
  }
}

export async function routeChat(messages: ChatMessage[]): Promise<ChatResponse> {
  const config = loadConfig()
  const maxAttempts = Math.max(1, Math.min(15, Number(config.max_backend_attempts ?? 15)))
  const retryLimit = Math.max(1, Number(config.retry_limit ?? 1))
  const backends = getEnabledBackends(config).slice(0, maxAttempts)

  if (backends.length === 0) {
    return {
      text: "No AI backends configured. Go to Settings → AI Backends to add an API key.",
      backend: 'none',
      model: 'none',
    }
  }

  const errors: string[] = []
  for (const backend of backends) {
    for (let attempt = 1; attempt <= retryLimit; attempt++) {
      try {
        return await callBackend(backend, messages)
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        errors.push(`${backend.name} [attempt ${attempt}/${retryLimit}]: ${reason}`)
      }
    }
  }

  return {
    text: `All AI backends failed. Errors: ${errors.join('; ')}. Check Settings → AI Backends.`,
    backend: 'error',
    model: 'none',
  }
}

export async function routeChatEnsemble(
  messages: ChatMessage[],
  options?: { backends?: string[]; count?: number }
): Promise<EnsembleResponse> {
  const config = loadConfig()
  const enabled = getEnabledBackends(config)
  if (enabled.length === 0) {
    return {
      final: {
        text: "No AI backends configured. Go to Settings → AI Backends to add an API key.",
        backend: 'none',
        model: 'none',
      },
      members: [],
      strategy: 'single',
    }
  }

  const requested = options?.backends ?? config.ensemble_backend_names
  const count = options?.count ?? config.ensemble_agent_count ?? 3
  const picked = pickEnsembleBackends(enabled, requested, count)

  if (picked.length < 2) {
    const single = await routeChat(messages)
    return {
      final: single,
      members: [{
        backend: single.backend,
        model: single.model,
        text: single.text,
        tokens: single.tokens,
        ok: single.backend !== 'error',
      }],
      strategy: 'single',
    }
  }

  const members = await Promise.all(picked.map(async (backend): Promise<EnsembleMember> => {
    try {
      const r = await callBackend(backend, messages)
      return { ...r, ok: true }
    } catch (error) {
      return {
        backend: backend.name,
        model: backend.model ?? 'unknown',
        text: '',
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }))

  const okMembers = members.filter((m) => m.ok && m.text.trim().length > 0)
  if (okMembers.length === 0) {
    return {
      final: {
        text: `All ensemble backends failed: ${members.map((m) => `${m.backend}: ${m.error ?? 'unknown error'}`).join('; ')}`,
        backend: 'error',
        model: 'none',
      },
      members,
      strategy: 'ensemble-3',
    }
  }
  if (okMembers.length === 1) {
    const only = okMembers[0]
    return {
      final: {
        text: only.text,
        backend: only.backend,
        model: only.model,
        tokens: only.tokens,
      },
      members,
      strategy: 'ensemble-3',
    }
  }

  const judgeBackend = enabled.find((b) => b.name === okMembers[0].backend) ?? enabled[0]
  const judgeMessages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are an adjudicator AI. Merge multi-model answers into one high-quality final answer. Keep it direct. Mention risks when conflicting guidance exists.',
    },
    {
      role: 'user',
      content: `Original user request:\n${messages.filter((m) => m.role === 'user').slice(-1)[0]?.content ?? ''}\n\nCandidate answers:\n${okMembers.map((m, i) => `# Candidate ${i + 1} (${m.backend}/${m.model})\n${m.text}`).join('\n\n')}\n\nReturn only the final merged answer.`,
    },
  ]

  try {
    const judged = await callBackend(judgeBackend, judgeMessages)
    return {
      final: judged,
      members,
      strategy: 'ensemble-3',
    }
  } catch {
    const fallback = okMembers[0]
    return {
      final: {
        text: fallback.text,
        backend: fallback.backend,
        model: fallback.model,
        tokens: fallback.tokens,
      },
      members,
      strategy: 'ensemble-3',
    }
  }
}
