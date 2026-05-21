import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { join, resolve } from 'path';
import { readdirSync, existsSync, readFileSync } from 'fs';
import { classifyDomains } from '../engines/classifier.js';
import { selectBookStack } from '../engines/bookRouter.js';
import { assessRisk, assessConfidence } from '../engines/riskConfidence.js';
import { buildContextPack } from '../engines/contextPackBuilder.js';
import { buildProposal } from '../engines/proposalEngine.js';
import { saveLesson, hasPriorLessons } from '../memory/selfLearning.js';
import { saveChatTrace, listConversations, getConversationHistory } from '../memory/chatHistory.js';
import { saveRunLog, listRunLogs, getRunLog } from '../logger.js';
import { loadConfig, saveConfig } from '../config/manager.js';
import { routeChat, routeChatOnBackend, routeChatEnsemble, type ChatMessage } from '../engines/aiRouter.js';
import { sendAlert } from '../engines/alerts.js';
import { getAppVersion } from '../version.js';
import { maskValue } from '../security/sanitize.js';
import { resolveSafeLibraryMarkdownPath } from '../security/safePath.js';
import { getLibraryPath } from '../storage/paths.js';
import {
  addRepo,
  analyzeRepo,
  digestRepo,
  acceptRepo,
  listRepos as listRepoMetadata,
  repoDetails,
  scoreRepoCard,
  expandLibraryByCategory,
  compressCategoryMiniBook,
  importReposFromMarkdown,
} from '../repos/service.js';
import { startAutoExpandWorker } from '../repos/autoExpand.js';

const app = new Hono();
const APP_VERSION = getAppVersion();
const LIBRARY_CATEGORIES = ['pocket-rules', 'mini-book', 'self-learning', 'user-style'] as const;
const WRITE_ACTION_ROUTES = new Set([
  '/learn',
  '/config',
  '/repo/clone',
  '/alert/test',
  '/repos/add',
  '/library/expand',
  '/library/compress',
  '/library/import-markdown',
]);
const WRITE_ACTION_ROUTE_PATTERNS = [
  /^\/repos\/[^/]+\/analyze$/,
  /^\/repos\/[^/]+\/score$/,
  /^\/repos\/[^/]+\/digest$/,
  /^\/repos\/[^/]+\/accept$/,
];

function isWriteActionRoute(path: string): boolean {
  if (WRITE_ACTION_ROUTES.has(path)) return true;
  return WRITE_ACTION_ROUTE_PATTERNS.some((p) => p.test(path));
}
const DEFAULT_ALLOWED_ORIGINS = [
  'http://127.0.0.1:8765',
  'http://localhost:8765',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
];

function getAllowedOrigins(): Set<string> {
  const extra = (process.env.BUILDERBRAIN_CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...extra]);
}

function getExpectedApiToken(): string | undefined {
  const fromEnv = process.env.BUILDERBRAIN_API_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  return loadConfig().api_token?.trim();
}

function requestToken(c: any): string | undefined {
  const fromHeader = c.req.header('x-api-token')?.trim();
  if (fromHeader) return fromHeader;
  const auth = c.req.header('authorization') ?? '';
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return bearer;
}

// CORS middleware
app.use('/*', async (c, next) => {
  const origin = c.req.header('origin');
  if (origin && !getAllowedOrigins().has(origin)) {
    return c.json({ error: 'Origin not allowed' }, 403);
  }
  await next();
  if (origin && getAllowedOrigins().has(origin)) {
    c.header('Access-Control-Allow-Origin', origin);
  }
  c.header('Vary', 'Origin');
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-token');
});

app.options('/*', (c) => new Response('', { status: 204 }));

app.use('/*', async (c, next) => {
  if (c.req.method === 'POST' && isWriteActionRoute(c.req.path)) {
    const expected = getExpectedApiToken();
    if (expected) {
      const provided = requestToken(c);
      if (!provided || provided !== expected) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
    }
  }
  await next();
});

function resolveBookPath(bookPath: string): string | null {
  return resolveSafeLibraryMarkdownPath(getLibraryPath(), bookPath, [...LIBRARY_CATEGORIES]);
}

app.get('/health', (c) => {
  return c.json({ ok: true, version: APP_VERSION });
});

app.get('/status', (c) => {
  const libraryPath = getLibraryPath();
  const runsPath = join(process.cwd(), 'brain-data', 'runs');

  let bookCount = 0;
  const categoryStats: Record<string, number> = {};
  for (const cat of LIBRARY_CATEGORIES) {
    const catPath = join(libraryPath, cat);
    const count = existsSync(catPath) ? readdirSync(catPath).filter((f) => f.endsWith('.md')).length : 0;
    categoryStats[cat] = count;
    bookCount += count;
  }

  const runCount = existsSync(runsPath) ? readdirSync(runsPath).filter((f) => f.endsWith('.json')).length : 0;

  return c.json({
    version: APP_VERSION,
    status: 'ok',
    books: bookCount,
    runs: runCount,
    hasPriorLessons: hasPriorLessons(),
    categories: categoryStats,
  });
});

app.get('/books', (c) => {
  const libraryPath = getLibraryPath();
  const result: Record<string, string[]> = {};

  for (const cat of LIBRARY_CATEGORIES) {
    const catPath = join(libraryPath, cat);
    result[cat] = existsSync(catPath) ? readdirSync(catPath).filter((f) => f.endsWith('.md')) : [];
  }

  return c.json(result);
});

app.get('/book', (c) => {
  const bookPath = c.req.query('path');
  if (!bookPath) return c.json({ error: 'Missing ?path= query param' }, 400);

  const resolved = resolveBookPath(bookPath);
  if (!resolved) return c.json({ error: 'Invalid book path' }, 400);
  if (!existsSync(resolved)) return c.json({ error: 'Book not found' }, 404);

  const content = readFileSync(resolved, 'utf-8');
  return c.json({ path: bookPath, content });
});

app.get('/library', (c) => {
  const libraryPath = getLibraryPath();
  const library: Record<string, Record<string, string>> = {};

  for (const cat of LIBRARY_CATEGORIES) {
    library[cat] = {};
    const catPath = join(libraryPath, cat);
    if (!existsSync(catPath)) continue;
    const files = readdirSync(catPath).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      library[cat][file] = readFileSync(join(catPath, file), 'utf-8');
    }
  }

  return c.json(library);
});

app.get('/runs', (c) => {
  const limit = Number(c.req.query('limit') ?? 10);
  return c.json(listRunLogs(limit));
});

app.get('/runs/:id', (c) => {
  const id = c.req.param('id');
  const log = getRunLog(id);
  if (!log) return c.json({ error: 'Run not found' }, 404);
  return c.json(log);
});

app.post('/context', async (c) => {
  const body = await c.req.json<{ task: string }>();
  if (!body?.task) return c.json({ error: 'Missing task in request body' }, 400);

  const { task } = body;
  const domains = classifyDomains(task);
  const bookStack = selectBookStack(domains);
  const risk = assessRisk(task, domains);
  const confidence = assessConfidence(task, domains, hasPriorLessons());
  const pack = buildContextPack(task, domains, bookStack, risk, confidence, getLibraryPath());

  saveRunLog({
    command: 'context',
    input: task,
    detectedDomains: domains,
    booksUsed: bookStack.map((b) => b.label),
    risk: risk.level,
    confidence: confidence.level,
    summary: `Context pack built via API for: ${task.slice(0, 80)}`,
  });

  return c.json(pack);
});

app.post('/propose', async (c) => {
  const body = await c.req.json<{ task: string }>();
  if (!body?.task) return c.json({ error: 'Missing task in request body' }, 400);

  const { task } = body;
  const domains = classifyDomains(task);
  const bookStack = selectBookStack(domains);
  const risk = assessRisk(task, domains);
  const confidence = assessConfidence(task, domains, hasPriorLessons());
  const proposal = buildProposal(task, domains, bookStack, risk, confidence);

  saveRunLog({
    command: 'propose',
    input: task,
    detectedDomains: domains,
    booksUsed: bookStack.map((b) => b.label),
    risk: risk.level,
    confidence: confidence.level,
    summary: `Proposal generated via API for: ${task.slice(0, 80)}`,
  });

  return c.json(proposal);
});

app.post('/learn', async (c) => {
  const body = await c.req.json<{
    task: string;
    problem: string;
    rootCause: string;
    solution: string;
    evidence: string;
  }>();

  if (!body?.task || !body?.problem || !body?.rootCause || !body?.solution || !body?.evidence) {
    return c.json({ error: 'Missing required fields: task, problem, rootCause, solution, evidence' }, 400);
  }

  saveLesson(body);

  saveRunLog({
    command: 'learn',
    input: body.task,
    detectedDomains: [],
    booksUsed: [],
    risk: 'Low',
    confidence: 'High',
    summary: `Lesson saved via API: ${body.task.slice(0, 80)}`,
  });

  return c.json({ success: true, message: 'Lesson saved to self-learning memory' });
});

app.post('/repo/clone', async (c) => {
  const body = await c.req.json<{ url: string; topic?: string }>();
  if (!body?.url) return c.json({ error: 'Missing url' }, 400);
  const result = addRepo(body.url, body.topic ?? 'general');
  if (result.success) {
    sendAlert(`🧠 <b>BuilderBrain</b>\nRepo added: <code>${result.repoName}</code>\nStatus: quarantined`).catch(() => {});
  }
  return c.json(result, result.success ? 200 : 400);
});

app.post('/alert/test', async (c) => {
  const result = await sendAlert('🧠 <b>BuilderBrain</b>\nAlert test — connected successfully!');
  return c.json(result);
});

app.get('/repos', (c) => {
  return c.json(listRepoMetadata());
});

app.post('/repos/add', async (c) => {
  const body = await c.req.json<{ url: string; topic?: string }>();
  if (!body?.url) return c.json({ error: 'Missing url' }, 400);
  const result = addRepo(body.url, body.topic ?? 'general');
  return c.json(result, result.success ? 200 : 400);
});

app.get('/repos/:id', (c) => {
  const id = c.req.param('id');
  const details = repoDetails(id);
  if (!details) return c.json({ error: 'Repo not found' }, 404);
  return c.json(details);
});

app.post('/repos/:id/analyze', (c) => {
  const id = c.req.param('id');
  const result = analyzeRepo(id);
  return c.json(result, result.success ? 200 : 400);
});

app.post('/repos/:id/score', (c) => {
  const id = c.req.param('id');
  const score = scoreRepoCard(id);
  if (!score) return c.json({ error: 'Repo not found or scoring failed' }, 404);
  return c.json(score);
});

app.post('/repos/:id/digest', (c) => {
  const id = c.req.param('id');
  const result = digestRepo(id);
  return c.json(result, result.success ? 200 : 400);
});

app.post('/repos/:id/accept', (c) => {
  const id = c.req.param('id');
  const result = acceptRepo(id);
  return c.json(result, result.success ? 200 : 400);
});

app.post('/library/expand', async (c) => {
  const body = await c.req.json<{ category: string; mostStarred?: number; fresh?: number; safe?: boolean }>();
  if (!body?.category) return c.json({ error: 'Missing category' }, 400);
  const result = await expandLibraryByCategory({
    category: body.category,
    mostStarred: body.mostStarred ?? 10,
    fresh: body.fresh ?? 5,
    safe: body.safe ?? true,
  });
  return c.json(result, result.success ? 200 : 400);
});

app.post('/library/compress', async (c) => {
  const body = await c.req.json<{ category: string }>();
  if (!body?.category) return c.json({ error: 'Missing category' }, 400);
  const result = compressCategoryMiniBook(body.category);
  return c.json(result, result.success ? 200 : 400);
});

app.post('/library/import-markdown', async (c) => {
  const body = await c.req.json<{ markdown?: string; filePath?: string; topic?: string; autoAnalyze?: boolean }>();
  if (!body?.markdown && !body?.filePath) {
    return c.json({ error: 'Provide markdown or filePath' }, 400);
  }
  const result = importReposFromMarkdown({
    markdown: body.markdown,
    filePath: body.filePath,
    topic: body.topic ?? 'general',
    autoAnalyze: body.autoAnalyze ?? true,
  });
  return c.json(result, result.success ? 200 : 400);
});

// ── Chat ──────────────────────────────────────────────────────────────────────

app.post('/chat', async (c) => {
  const body = await c.req.json<{
    messages: ChatMessage[];
    task?: string;
    conversationId?: string;
    collaborate?: boolean;
    reviewerBackend?: string;
    ensemble?: boolean;
    ensembleCount?: number;
    ensembleBackends?: string[];
  }>();
  if (!body?.messages?.length) return c.json({ error: 'Missing messages' }, 400);

  const libraryPath = getLibraryPath();
  const bookList: string[] = [];
  for (const cat of LIBRARY_CATEGORIES) {
    const catPath = join(libraryPath, cat);
    if (existsSync(catPath)) {
      readdirSync(catPath).filter((f) => f.endsWith('.md')).forEach((f) => bookList.push(`${cat}/${f}`));
    }
  }

  // Auto-detect repo clone intent in the last user message
  let cloneNote = '';
  const lastMsg = body.messages[body.messages.length - 1]?.content ?? '';
  const githubUrl = lastMsg.match(/https?:\/\/(?:www\.)?github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?/i)?.[0];
  const cloneIntent = /\b(clone|download|add|get|fetch|grab|save|pull)\b/i.test(lastMsg);
  if (githubUrl && cloneIntent) {
    const expected = getExpectedApiToken();
    const provided = requestToken(c);
    if (!expected || (provided && provided === expected)) {
      const result = addRepo(githubUrl, 'general');
      cloneNote = `\n\nACTION TAKEN: ${result.message}`;
      if (result.success) {
        cloneNote += `\nRepo is now in quarantine with id ${result.repoId}.`;
      }
    } else {
      cloneNote = '\n\nACTION BLOCKED: Repo cloning requires valid API token.';
    }
  }

  let taskSection = '';
  if (body.task) {
    const domains = classifyDomains(body.task);
    const bookStack = selectBookStack(domains);
    const risk = assessRisk(body.task, domains);
    const confidence = assessConfidence(body.task, domains, hasPriorLessons());
    buildContextPack(body.task, domains, bookStack, risk, confidence, libraryPath);
    taskSection = `\nACTIVE TASK: "${body.task}"\nDomains: ${domains.join(', ')} | Risk: ${risk.level} (${risk.score}/100) | Confidence: ${confidence.level}\nBooks loaded: ${bookStack.map((b) => b.label).join(', ')}`;
  }

  const systemPrompt = `You are BuilderBrain — a personal AI librarian and engineering brain running locally at http://localhost:8765.

WHO YOU ARE:
You are NOT a generic AI. You are the user's personal library AI with ${bookList.length} curated knowledge books.
You give direct, practical answers. No "I'm just an AI" disclaimers. No generic advice.
You are opinionated, efficient, and always reference the library first.

YOUR LIBRARY (${bookList.length} books):
${bookList.map((b) => `  • ${b}`).join('\n')}

WHAT YOU CAN DO:
- Answer coding questions using library patterns
- Analyze tasks for risk, domains, and required books
- Download and save repos automatically when user provides a GitHub URL (already handled server-side)
- Help plan projects using the user's proven patterns
- Tell the user exactly which repos to add and why

WHEN A REPO WAS JUST CLONED:
Tell the user it's saved in brain-data/big-bible/repos/ and what they can do with it next.
Be direct: "Done. Cloned X to your library."

WHEN ASKED ABOUT YOUR CAPABILITIES:
Explain what you ARE (a local library AI with their knowledge) not what you aren't.
${taskSection}${cloneNote}`;

  const messages = [{ role: 'system' as const, content: systemPrompt }, ...body.messages];
  const config = loadConfig();
  const ensembleEnabled = Boolean(body.ensemble ?? config.ensemble_enabled);
  const ensemble = ensembleEnabled
    ? await routeChatEnsemble(messages, {
      count: body.ensembleCount ?? config.ensemble_agent_count ?? 3,
      backends: body.ensembleBackends ?? config.ensemble_backend_names ?? [],
    })
    : null;
  const response = ensemble ? ensemble.final : await routeChat(messages);
  const collaborationEnabled = Boolean(body.collaborate ?? config.collaboration_enabled);
  const reviewerBackend = body.reviewerBackend ?? config.collaborator_backend;

  let collaborator: { backend: string; model: string; text: string; tokens?: number } | undefined;
  let finalText = response.text;

  if (!ensemble && collaborationEnabled && reviewerBackend && reviewerBackend !== response.backend) {
    const reviewMessages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are a peer-review AI. Improve the primary answer for engineering quality: point out risks, missing checks, and exact file-level next steps. Keep it concise.',
      },
      {
        role: 'user',
        content: `User message:\n${lastMsg}\n\nPrimary answer:\n${response.text}\n\nReturn an improved answer with concrete next actions.`,
      },
    ];
    const reviewed = await routeChatOnBackend(reviewerBackend, reviewMessages);
    if (reviewed.backend !== 'error' && reviewed.text.trim()) {
      collaborator = {
        backend: reviewed.backend,
        model: reviewed.model,
        text: reviewed.text,
        tokens: reviewed.tokens,
      };
      finalText = `${response.text}\n\n---\nPeer Review (${reviewed.backend} / ${reviewed.model}):\n${reviewed.text}`;
    }
  }

  const lastUserMessage = body.messages.filter((m) => m.role === 'user').slice(-1)[0]?.content ?? '';
  const trace = saveChatTrace({
    conversationId: body.conversationId,
    task: body.task,
    userMessage: lastUserMessage,
    assistantMessage: finalText,
    backend: response.backend,
    model: response.model,
    tokens: (response.tokens ?? 0) + (collaborator?.tokens ?? 0),
  });
  return c.json({
    ...response,
    text: finalText,
    tokens: (response.tokens ?? 0) + (collaborator?.tokens ?? 0),
    conversationId: trace.conversationId,
    collaborator,
    ensemble: ensemble ? {
      strategy: ensemble.strategy,
      members: ensemble.members.map((m) => ({
        backend: m.backend,
        model: m.model,
        ok: m.ok,
        tokens: m.tokens,
        error: m.error,
        text: m.text,
      })),
    } : undefined,
  });
});

app.get('/chat/history', (c) => {
  const limit = Number(c.req.query('limit') ?? 50);
  return c.json(listConversations(limit));
});

app.get('/chat/history/:id', (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'Missing conversation id' }, 400);
  return c.json(getConversationHistory(id));
});

app.get('/config', (c) => {
  const config = loadConfig();
  // Mask secrets before returning config
  const masked = {
    ...config,
    api_token: maskValue(config.api_token),
    ai_backends: config.ai_backends.map((b) => ({
      ...b,
      apiKey: maskValue(b.apiKey),
    })),
    alerts: {
      ...config.alerts,
      telegram_bot_token: maskValue(config.alerts.telegram_bot_token),
      slack_webhook: maskValue(config.alerts.slack_webhook),
    },
  };
  return c.json(masked);
});

app.post('/config', async (c) => {
  const body = await c.req.json<Partial<typeof loadConfig extends () => infer R ? R : never>>();
  if (!body) return c.json({ error: 'Missing config body' }, 400);

  const current = loadConfig();
  const updated = { ...current, ...body };
  saveConfig(updated);
  return c.json({ success: true, message: 'Config saved' });
});

// Serve dashboard static files if built
const dashboardPath = join(process.cwd(), 'dist', 'dashboard');
if (existsSync(dashboardPath)) {
  app.use('/*', serveStatic({ root: './dist/dashboard' }));
}

export function startServer(port = 8765, hostname = '127.0.0.1'): void {
  startAutoExpandWorker();
  serve({ fetch: app.fetch, port, hostname }, () => {
    console.log(`BuilderBrain running at http://${hostname}:${port}`);
    console.log(`Dashboard: http://${hostname}:${port}`);
    console.log(`API: http://${hostname}:${port}/status`);
  });
}

export default app;

// Run when executed directly via `npm start` or `tsx src/api/index.ts`
import { fileURLToPath } from 'url';
const isMain = process.argv[1] &&
  (process.argv[1] === fileURLToPath(import.meta.url) ||
   process.argv[1].endsWith('src/api/index.ts') ||
   process.argv[1].endsWith('src/api/index.js'));
if (isMain) startServer();
