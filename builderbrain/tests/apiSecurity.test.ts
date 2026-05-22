import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const tmpBase = join(tmpdir(), `bb-api-test-${Date.now()}`);
const origCwd = process.cwd;
process.cwd = () => tmpBase;

const { default: app } = await import('../src/api/index.js');

describe('api security boundaries', () => {
  beforeEach(() => {
    process.cwd = () => tmpBase;
    rmSync(tmpBase, { recursive: true, force: true });
    mkdirSync(join(tmpBase, 'brain-data', 'library', 'mini-book'), { recursive: true });
    mkdirSync(join(tmpBase, 'brain-data', 'runs'), { recursive: true });
    writeFileSync(join(tmpBase, 'brain-data', 'library', 'mini-book', 'security.md'), '# Security\n', 'utf-8');
    writeFileSync(join(tmpBase, 'outside.md'), 'outside-data', 'utf-8');
  });

  afterEach(() => {
    process.cwd = origCwd;
  });

  it('serves valid books from inside the library', async () => {
    const response = await app.request('/book?path=mini-book/security.md');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ path: 'mini-book/security.md', content: '# Security\n' });
  });

  it('rejects book path traversal', async () => {
    const response = await app.request('/book?path=../../outside.md');
    expect(response.status).toBe(400);
  });

  it('rejects invalid run ids before filesystem lookup', async () => {
    const response = await app.request('/runs/not-a-uuid');
    expect(response.status).toBe(400);
  });

  it('rejects non-direct GitHub clone URLs', async () => {
    const response = await app.request('/repo/clone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/openai/codex/tree/main;touch-owned' }),
    });
    expect(response.status).toBe(400);
  });

  it('rejects GitHub clone URLs with query strings', async () => {
    const response = await app.request('/repo/clone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/openai/codex.git?x=1' }),
    });
    expect(response.status).toBe(400);
  });

  it('preserves stored API keys when saving a masked config response', async () => {
    const configPath = join(tmpBase, 'brain-data', 'config.json');
    writeFileSync(configPath, JSON.stringify({
      ai_backends: [{
        name: 'groq-llama',
        type: 'openai-compatible',
        endpoint: 'https://api.groq.com/openai/v1',
        apiKey: 'test-key-value',
        model: 'llama-3.3-70b-versatile',
        priority: 1,
        enabled: true,
      }],
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
    }), 'utf-8');

    const masked = await app.request('/config').then((r) => r.json() as Promise<any>);
    expect(masked.ai_backends[0].apiKey).toBe('test***');

    const saveResponse = await app.request('/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(masked),
    });

    expect(saveResponse.status).toBe(200);
    expect(JSON.parse(readFileSync(configPath, 'utf-8')).ai_backends[0].apiKey).toBe('test-key-value');
  });

  describe('token authentication middleware', () => {
    const origEnv = process.env.BUILDERBRAIN_API_TOKEN;
    
    afterEach(() => {
      process.env.BUILDERBRAIN_API_TOKEN = origEnv;
    });

    it('allows requests without token when BUILDERBRAIN_API_TOKEN is unset', async () => {
      delete process.env.BUILDERBRAIN_API_TOKEN;
      const response = await app.request('/config');
      expect(response.status).toBe(200);
    });

    it('rejects unauthenticated requests when BUILDERBRAIN_API_TOKEN is set', async () => {
      process.env.BUILDERBRAIN_API_TOKEN = 'secret123';
      const response = await app.request('/config');
      expect(response.status).toBe(401);
    });

    it('allows authenticated requests when BUILDERBRAIN_API_TOKEN is set', async () => {
      process.env.BUILDERBRAIN_API_TOKEN = 'secret123';
      const response = await app.request('/config', {
        headers: { 'Authorization': 'Bearer secret123' }
      });
      expect(response.status).toBe(200);
    });

    it('allows /health requests even when BUILDERBRAIN_API_TOKEN is set', async () => {
      process.env.BUILDERBRAIN_API_TOKEN = 'secret123';
      const response = await app.request('/health');
      expect(response.status).toBe(200);
    });
  });
});
