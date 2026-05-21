import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';

vi.mock('child_process', () => ({
  spawnSync: vi.fn(),
}));

describe('api security and integration', () => {
  const originalCwd = process.cwd;
  const tempRoot = join(tmpdir(), `builderbrain-api-${Date.now()}`);
  let app: any;
  let originalFetch: typeof fetch;

  beforeAll(async () => {
    mkdirSync(join(tempRoot, 'brain-data', 'library', 'mini-book'), { recursive: true });
    mkdirSync(join(tempRoot, 'brain-data', 'library', 'pocket-rules'), { recursive: true });
    mkdirSync(join(tempRoot, 'brain-data', 'library', 'self-learning'), { recursive: true });
    mkdirSync(join(tempRoot, 'brain-data', 'library', 'user-style'), { recursive: true });
    writeFileSync(join(tempRoot, 'brain-data', 'library', 'mini-book', 'security.md'), '# Security', 'utf-8');
    writeFileSync(
      join(tempRoot, 'brain-data', 'config.json'),
      JSON.stringify(
        {
          api_token: 'test-token-123',
          ai_backends: [{ name: 'x', type: 'openai-compatible', apiKey: 'sk-proj-secret-1234567890123456', priority: 1, enabled: true }],
          alerts: { telegram_bot_token: '123456:abcdefghijklmnopqrstuvwxyzABCDEFGHIJ', slack_webhook: 'https://hooks.slack.com/services/T/A/B' },
          daily_trends: { enabled: false, search_apis: ['brave'], schedule_time: '09:00', filter_min_stars: 100, max_repos_per_day: 5 },
          fallback_strategy: 'smart-fallback',
          port: 8765,
        },
        null,
        2
      ),
      'utf-8'
    );
    writeFileSync(join(tempRoot, 'package.json'), JSON.stringify({ name: 'builderbrain-test', version: '9.9.9' }), 'utf-8');

    process.cwd = () => tempRoot;
    app = (await import('../src/api/index.js')).default;
    originalFetch = globalThis.fetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
    process.cwd = originalCwd;
    rmSync(tempRoot, { recursive: true, force: true });
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns app version from package.json in /health', async () => {
    const res = await app.request('http://localhost/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.version).toBe('9.9.9');
  });

  it('serves valid books and blocks traversal in /book', async () => {
    const ok = await app.request('http://localhost/book?path=mini-book/security.md');
    expect(ok.status).toBe(200);

    const traversal = await app.request('http://localhost/book?path=../package.json');
    expect(traversal.status).toBe(400);

    const encodedTraversal = await app.request('http://localhost/book?path=mini-book/%2e%2e%2fsecurity.md');
    expect(encodedTraversal.status).toBe(400);
  });

  it('masks secrets in /config', async () => {
    const res = await app.request('http://localhost/config');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.api_token).toContain('***');
    expect(body.ai_backends[0].apiKey).toContain('***');
    expect(body.alerts.telegram_bot_token).toContain('***');
    expect(body.alerts.slack_webhook).toContain('***');
  });

  it('serves /context and /propose for task payloads', async () => {
    const contextRes = await app.request('http://localhost/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'Fix security regression in auth middleware' }),
    });
    expect(contextRes.status).toBe(200);
    const contextBody = await contextRes.json();
    expect(contextBody.task).toContain('Fix security regression');

    const proposeRes = await app.request('http://localhost/propose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'Fix security regression in auth middleware' }),
    });
    expect(proposeRes.status).toBe(200);
    const proposeBody = await proposeRes.json();
    expect(proposeBody.task).toContain('Fix security regression');
  });

  it('protects write route /repo/clone when API token is set', async () => {
    const blocked = await app.request('http://localhost/repo/clone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/user/repo' }),
    });
    expect(blocked.status).toBe(401);
  });

  it('uses spawnSync for safe clone path when token is provided', async () => {
    const mockSpawn = vi.mocked(spawnSync);
    mockSpawn.mockImplementationOnce((_, args) => {
      const target = (args as string[])[3];
      mkdirSync(target, { recursive: true });
      return {
        status: 0,
        stdout: 'ok',
        stderr: '',
        output: [],
        pid: 123,
        signal: null,
      } as ReturnType<typeof spawnSync>;
    });

    const res = await app.request('http://localhost/repo/clone', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token-123',
      },
      body: JSON.stringify({ url: 'https://github.com/mohit/demo-repo.git' }),
    });

    expect(res.status).toBe(200);
    expect(mockSpawn).toHaveBeenCalled();
    const [cmd, args] = mockSpawn.mock.calls[0] as [string, string[]];
    expect(cmd).toBe('git');
    expect(args[0]).toBe('clone');
    expect(args[2]).toBe('https://github.com/mohit/demo-repo.git');
  });

  it('supports repo add/list/show/analyze endpoints', async () => {
    const mockSpawn = vi.mocked(spawnSync);
    mockSpawn.mockImplementationOnce((_, args) => {
      const target = (args as string[])[3];
      mkdirSync(target, { recursive: true });
      writeFileSync(join(target, 'README.md'), '# demo', 'utf-8');
      writeFileSync(join(target, 'LICENSE'), 'MIT License', 'utf-8');
      writeFileSync(join(target, 'package.json'), JSON.stringify({ name: 'demo' }), 'utf-8');
      return {
        status: 0,
        stdout: 'ok',
        stderr: '',
        output: [],
        pid: 124,
        signal: null,
      } as ReturnType<typeof spawnSync>;
    });

    const addRes = await app.request('http://localhost/repos/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token-123',
      },
      body: JSON.stringify({ url: 'https://github.com/mohit/repo-flow', topic: 'testing-quality' }),
    });
    expect(addRes.status).toBe(200);
    const addBody = await addRes.json();
    expect(addBody.success).toBe(true);
    expect(addBody.repoId).toBe('mohit__repo-flow');

    const listRes = await app.request('http://localhost/repos');
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.some((x: any) => x.id === 'mohit__repo-flow')).toBe(true);

    const analyzeRes = await app.request('http://localhost/repos/mohit__repo-flow/analyze', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token-123',
      },
    });
    expect(analyzeRes.status).toBe(200);

    const showRes = await app.request('http://localhost/repos/mohit__repo-flow');
    expect(showRes.status).toBe(200);
    const showBody = await showRes.json();
    expect(showBody.metadata.id).toBe('mohit__repo-flow');
    expect(showBody.score.qualityScore).toBeGreaterThan(0);
  });

  it('persists chat history server-side and exposes history endpoints', async () => {
    globalThis.fetch = vi.fn(async () => new Response(
      JSON.stringify({
        choices: [{ message: { content: 'BRAIN_OK' } }],
        usage: { total_tokens: 11 },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )) as typeof fetch;

    const chatRes = await app.request('http://localhost/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: 'conv_test_001',
        messages: [{ role: 'user', content: 'hello from user' }],
      }),
    });

    expect(chatRes.status).toBe(200);
    const chatBody = await chatRes.json();
    expect(chatBody.text).toContain('BRAIN_OK');
    expect(chatBody.conversationId).toBe('conv_test_001');

    const listRes = await app.request('http://localhost/chat/history?limit=10');
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(Array.isArray(listBody)).toBe(true);
    expect(listBody.some((x: any) => x.conversationId === 'conv_test_001')).toBe(true);

    const historyRes = await app.request('http://localhost/chat/history/conv_test_001');
    expect(historyRes.status).toBe(200);
    const historyBody = await historyRes.json();
    expect(Array.isArray(historyBody)).toBe(true);
    expect(historyBody[0].userMessage).toContain('hello from user');
    expect(historyBody[0].assistantMessage).toContain('BRAIN_OK');
  });
});
