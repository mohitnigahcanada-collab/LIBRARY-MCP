import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

export interface AIBackend {
  name: string
  type: 'openai' | 'anthropic' | 'openai-compatible' | 'local'
  endpoint?: string
  apiKey?: string
  apiKeyService?: string
  apiKeyUsername?: string
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
  trend_radar?: {
    enabled: boolean
    schedule_cron: string
    github_token?: string
    brave_api_key?: string
    min_stars: number
    languages: string[]
    topics: string[]
  }
  repo_analysis?: {
    enabled: boolean
    auto_analyze_on_clone: boolean
    timeout_seconds: number
  }
  knowledge_evolution?: {
    enabled: boolean
    run_frequency_hours: number
    min_pattern_count: number
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

export function mergeConfigUpdate(current: Config, update: Partial<Config>): Config {
  const merged: Config = { ...current, ...update }

  if (update.alerts) {
    merged.alerts = { ...current.alerts, ...update.alerts }
  }

  if (update.daily_trends) {
    merged.daily_trends = { ...current.daily_trends, ...update.daily_trends }
  }

  if (update.ai_backends) {
    merged.ai_backends = update.ai_backends.map((backend) => {
      const existing = current.ai_backends.find((b) => b.name === backend.name)
      if (existing?.apiKey && backend.apiKey?.endsWith('***')) {
        return { ...backend, apiKey: existing.apiKey }
      }
      return backend
    })
  }

  return merged
}

export function getEnabledBackends(config: Config): AIBackend[] {
  return config.ai_backends
    .filter((b) => b.enabled)
    .sort((a, b) => a.priority - b.priority)
}
