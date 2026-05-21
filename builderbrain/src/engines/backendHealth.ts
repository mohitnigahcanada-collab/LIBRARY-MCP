import { loadConfig, saveConfig, type AIBackend } from '../config/manager.js';

interface HealthStats {
  backend: string;
  model: string;
  totalCalls: number;
  successCalls: number;
  failureCalls: number;
  avgLatencyMs: number;
  lastError?: string;
  lastStatus: 'ok' | 'fail';
  updatedAt: string;
}

const HEALTH = new Map<string, HealthStats>();
let monitorStarted = false;

function keyFor(backend: string, model: string): string {
  return `${backend}::${model}`;
}

export function recordBackendResult(input: {
  backend: string;
  model: string;
  ok: boolean;
  latencyMs: number;
  error?: string;
}): void {
  const key = keyFor(input.backend, input.model);
  const existing = HEALTH.get(key);
  const totalCalls = (existing?.totalCalls ?? 0) + 1;
  const successCalls = (existing?.successCalls ?? 0) + (input.ok ? 1 : 0);
  const failureCalls = (existing?.failureCalls ?? 0) + (input.ok ? 0 : 1);
  const prevAvg = existing?.avgLatencyMs ?? input.latencyMs;
  const avgLatencyMs = (prevAvg * (totalCalls - 1) + input.latencyMs) / totalCalls;

  HEALTH.set(key, {
    backend: input.backend,
    model: input.model,
    totalCalls,
    successCalls,
    failureCalls,
    avgLatencyMs: Math.round(avgLatencyMs * 10) / 10,
    lastError: input.ok ? undefined : input.error,
    lastStatus: input.ok ? 'ok' : 'fail',
    updatedAt: new Date().toISOString(),
  });
}

export function getBackendHealth() {
  return Array.from(HEALTH.values()).sort((a, b) => {
    const aRate = a.totalCalls > 0 ? a.successCalls / a.totalCalls : 0;
    const bRate = b.totalCalls > 0 ? b.successCalls / b.totalCalls : 0;
    if (bRate !== aRate) return bRate - aRate;
    return a.avgLatencyMs - b.avgLatencyMs;
  });
}

async function pingOneBackend(backend: AIBackend): Promise<void> {
  const endpoint = backend.endpoint ?? 'https://api.openai.com/v1';
  const model = backend.model ?? 'gpt-4-turbo';
  const apiKey = backend.apiKey ?? '';

  const t0 = Date.now();
  try {
    const res = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Reply with: OK' }],
        max_tokens: 4,
        temperature: 0,
        stream: false,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const latency = Date.now() - t0;
    if (!res.ok) {
      recordBackendResult({
        backend: backend.name,
        model,
        ok: false,
        latencyMs: latency,
        error: `HTTP ${res.status}`,
      });
      return;
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content ?? '';
    recordBackendResult({
      backend: backend.name,
      model,
      ok: text.trim().length > 0,
      latencyMs: latency,
      error: text.trim().length > 0 ? undefined : 'empty response',
    });
  } catch (error) {
    recordBackendResult({
      backend: backend.name,
      model,
      ok: false,
      latencyMs: Date.now() - t0,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function healthScore(backend: AIBackend): number {
  const model = backend.model ?? '';
  const stat = HEALTH.get(keyFor(backend.name, model));
  if (!stat || stat.totalCalls === 0) return Number.NEGATIVE_INFINITY;
  const successRate = stat.successCalls / stat.totalCalls;
  return successRate * 1000 - stat.avgLatencyMs;
}

function reorderBackendsByHealth(): void {
  const cfg = loadConfig();
  const enabled = cfg.ai_backends.filter((b) => b.enabled);
  if (enabled.length < 2) return;

  const sorted = [...enabled].sort((a, b) => healthScore(b) - healthScore(a));
  const byName = new Map(sorted.map((b, i) => [b.name, i + 1]));
  const updated = cfg.ai_backends.map((b) => ({
    ...b,
    priority: byName.get(b.name) ?? (cfg.ai_backends.length + 1),
  }));
  saveConfig({ ...cfg, ai_backends: updated });
}

async function monitorTick(): Promise<void> {
  const cfg = loadConfig();
  const enabled = cfg.ai_backends.filter((b) => b.enabled);
  for (const backend of enabled) {
    await pingOneBackend(backend);
  }
  if (cfg.auto_reorder_backends) {
    reorderBackendsByHealth();
  }
}

export function startBackendHealthMonitor(): void {
  if (monitorStarted) return;
  monitorStarted = true;
  const cfg = loadConfig();
  if (!cfg.health_monitor_enabled) return;

  monitorTick().catch(() => {});
  const intervalMs = Math.max(30, cfg.health_monitor_interval_sec ?? 300) * 1000;
  const timer = setInterval(() => {
    monitorTick().catch(() => {});
  }, intervalMs);
  timer.unref?.();
}
