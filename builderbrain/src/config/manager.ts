import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

export interface AIBackend {
  name: string
  type: 'openai' | 'anthropic' | 'openai-compatible' | 'local'
  endpoint?: string
  apiKey?: string
  model?: string
  priority: number
  enabled: boolean
}

export interface Config {
  ai_backends: AIBackend[]
  fallback_strategy: 'round-robin' | 'smart-fallback' | 'load-balance'
  port: number
  alerts: {
    telegram_chat_id?: string
    telegram_bot_token?: string
    slack_webhook?: string
  }
  daily_trends: {
    enabled: boolean
    search_apis: string[]
    schedule_time: string
    filter_min_stars: number
    max_repos_per_day: number
  }
}

const DEFAULT_CONFIG: Config = {
  ai_backends: [],
  fallback_strategy: 'smart-fallback',
  port: 8765,
  alerts: {},
  daily_trends: {
    enabled: false,
    search_apis: ['brave'],
    schedule_time: '09:00',
    filter_min_stars: 100,
    max_repos_per_day: 5,
  },
}

function getConfigPath(): string {
  return join(process.cwd(), 'brain-data', 'config.json')
}

export function loadConfig(): Config {
  const configPath = getConfigPath()
  if (!existsSync(configPath)) return { ...DEFAULT_CONFIG }
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(configPath, 'utf-8')) }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveConfig(config: Config): void {
  const configPath = getConfigPath()
  mkdirSync(join(process.cwd(), 'brain-data'), { recursive: true })
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

export function getEnabledBackends(config: Config): AIBackend[] {
  return config.ai_backends
    .filter((b) => b.enabled)
    .sort((a, b) => a.priority - b.priority)
}
