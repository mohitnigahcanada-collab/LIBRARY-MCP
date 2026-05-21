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
  api_token?: string
  max_backend_attempts: number
  retry_limit: number
  collaboration_enabled?: boolean
  collaborator_backend?: string
  ensemble_enabled?: boolean
  ensemble_agent_count?: number
  ensemble_backend_names?: string[]
  library_path_override?: string
  warehouse_path_override?: string
  auto_expand: {
    enabled: boolean
    interval_minutes: number
    categories: string[]
    most_starred: number
    fresh: number
    safe: boolean
    target_books_min: number
    cycle_repo_budget: number
    use_ai_curation: boolean
  }
  auto_reorder_backends?: boolean
  health_monitor_enabled?: boolean
  health_monitor_interval_sec?: number
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
  max_backend_attempts: 15,
  retry_limit: 1,
  collaboration_enabled: false,
  collaborator_backend: undefined,
  ensemble_enabled: true,
  ensemble_agent_count: 3,
  ensemble_backend_names: [],
  library_path_override: undefined,
  warehouse_path_override: undefined,
  auto_expand: {
    enabled: true,
    interval_minutes: 30,
    categories: [
      'ai-agent-frameworks',
      'docs-devex',
      'cli-terminal-tools',
      'ai-coding-agents',
      'backend-engineering',
      'frontend-engineering',
      'security-engineering',
      'testing-quality',
    ],
    most_starred: 10,
    fresh: 5,
    safe: true,
    target_books_min: 100,
    cycle_repo_budget: 6,
    use_ai_curation: true,
  },
  auto_reorder_backends: false,
  health_monitor_enabled: false,
  health_monitor_interval_sec: 300,
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
    const parsed = JSON.parse(readFileSync(configPath, 'utf-8')) as Partial<Config>
    const parsedAuto = (parsed.auto_expand ?? {}) as Partial<Config['auto_expand']>
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      alerts: { ...DEFAULT_CONFIG.alerts, ...(parsed.alerts ?? {}) },
      daily_trends: { ...DEFAULT_CONFIG.daily_trends, ...(parsed.daily_trends ?? {}) },
      auto_expand: {
        enabled: parsedAuto.enabled ?? DEFAULT_CONFIG.auto_expand.enabled,
        interval_minutes: parsedAuto.interval_minutes ?? DEFAULT_CONFIG.auto_expand.interval_minutes,
        categories: parsedAuto.categories ?? DEFAULT_CONFIG.auto_expand.categories,
        most_starred: parsedAuto.most_starred ?? DEFAULT_CONFIG.auto_expand.most_starred,
        fresh: parsedAuto.fresh ?? DEFAULT_CONFIG.auto_expand.fresh,
        safe: parsedAuto.safe ?? DEFAULT_CONFIG.auto_expand.safe,
        target_books_min: parsedAuto.target_books_min ?? DEFAULT_CONFIG.auto_expand.target_books_min,
        cycle_repo_budget: parsedAuto.cycle_repo_budget ?? DEFAULT_CONFIG.auto_expand.cycle_repo_budget,
        use_ai_curation: parsedAuto.use_ai_curation ?? DEFAULT_CONFIG.auto_expand.use_ai_curation,
      },
    }
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
