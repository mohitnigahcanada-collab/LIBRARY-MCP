import { loadConfig, getEnabledBackends, type AIBackend } from '../config/manager.js'
import { execFileSync } from 'child_process'

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

const KEYRING_SERVICE_BY_BACKEND: Record<string, string> = {
  'groq-llama': 'groq',
  'gemini-flash': 'gemini-api',
  'siliconflow-deepseek': 'siliconflow',
  'nvidia-llama': 'nvidia',
  'poolside-code': 'poolside',
}

function readGnomeKeyring(service: string, username = 'default'): string | undefined {
  try {
    return execFileSync('secret-tool', ['lookup', 'service', service, 'username', username], {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || undefined
  } catch {
    return undefined
  }
}

function resolveApiKey(backend: AIBackend): string {
  const service = backend.apiKeyService ?? KEYRING_SERVICE_BY_BACKEND[backend.name]
  const keyringKey = service ? readGnomeKeyring(service, backend.apiKeyUsername) : undefined
  return keyringKey ?? backend.apiKey ?? ''
}

async function callBackend(backend: AIBackend, messages: ChatMessage[]): Promise<ChatResponse> {
  const endpoint = backend.endpoint ?? 'https://api.openai.com/v1'
  const model = backend.model ?? 'gpt-4-turbo'
  const apiKey = resolveApiKey(backend)

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

  return {
    text: data.choices[0]?.message?.content ?? '',
    backend: backend.name,
    model,
    tokens: data.usage?.total_tokens,
  }
}

export async function routeChat(messages: ChatMessage[]): Promise<ChatResponse> {
  const config = loadConfig()
  const backends = getEnabledBackends(config)

  if (backends.length === 0) {
    return {
      text: "No AI backends configured. Go to Settings → AI Backends to add an API key.",
      backend: 'none',
      model: 'none',
    }
  }

  const errors: string[] = []
  for (const backend of backends) {
    try {
      return await callBackend(backend, messages)
    } catch (err) {
      errors.push(`${backend.name}: ${err instanceof Error ? err.message : String(err)}`)
      continue
    }
  }

  return {
    text: `All AI backends failed. Errors: ${errors.join('; ')}. Check Settings → AI Backends.`,
    backend: 'error',
    model: 'none',
  }
}
