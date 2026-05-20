import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { join } from 'path';
import { readdirSync, existsSync, readFileSync } from 'fs';
import { classifyDomains } from '../engines/classifier.js';
import { selectBookStack } from '../engines/bookRouter.js';
import { assessRisk, assessConfidence } from '../engines/riskConfidence.js';
import { buildContextPack } from '../engines/contextPackBuilder.js';
import { buildProposal } from '../engines/proposalEngine.js';
import { saveLesson, hasPriorLessons } from '../memory/selfLearning.js';
import { saveRunLog, listRunLogs, getRunLog } from '../logger.js';
import { loadConfig, saveConfig } from '../config/manager.js';
import { routeChat, type ChatMessage } from '../engines/aiRouter.js';

const app = new Hono();

// CORS middleware
app.use('/*', async (c, next) => {
  await next();
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
});

app.options('/*', (c) => new Response('', { status: 204 }));

function getLibraryPath(): string {
  return join(process.cwd(), 'brain-data', 'library');
}

app.get('/health', (c) => {
  return c.json({ ok: true, version: '2.0.0' });
});

app.get('/status', (c) => {
  const libraryPath = getLibraryPath();
  const runsPath = join(process.cwd(), 'brain-data', 'runs');
  const categories = ['pocket-rules', 'mini-book', 'self-learning', 'user-style'];

  let bookCount = 0;
  const categoryStats: Record<string, number> = {};
  for (const cat of categories) {
    const catPath = join(libraryPath, cat);
    const count = existsSync(catPath) ? readdirSync(catPath).filter((f) => f.endsWith('.md')).length : 0;
    categoryStats[cat] = count;
    bookCount += count;
  }

  const runCount = existsSync(runsPath) ? readdirSync(runsPath).filter((f) => f.endsWith('.json')).length : 0;

  return c.json({
    version: '2.0.0',
    status: 'ok',
    books: bookCount,
    runs: runCount,
    hasPriorLessons: hasPriorLessons(),
    categories: categoryStats,
  });
});

app.get('/books', (c) => {
  const libraryPath = getLibraryPath();
  const categories = ['pocket-rules', 'mini-book', 'self-learning', 'user-style'];
  const result: Record<string, string[]> = {};

  for (const cat of categories) {
    const catPath = join(libraryPath, cat);
    result[cat] = existsSync(catPath) ? readdirSync(catPath).filter((f) => f.endsWith('.md')) : [];
  }

  return c.json(result);
});

app.get('/book', (c) => {
  const bookPath = c.req.query('path');
  if (!bookPath) return c.json({ error: 'Missing ?path= query param' }, 400);

  const resolved = join(getLibraryPath(), bookPath);
  if (!existsSync(resolved)) return c.json({ error: 'Book not found' }, 404);

  const content = readFileSync(resolved, 'utf-8');
  return c.json({ path: bookPath, content });
});

app.get('/library', (c) => {
  const libraryPath = getLibraryPath();
  const categories = ['pocket-rules', 'mini-book', 'self-learning', 'user-style'];
  const library: Record<string, Record<string, string>> = {};

  for (const cat of categories) {
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

app.post('/chat', async (c) => {
  const body = await c.req.json<{ messages: ChatMessage[]; task?: string }>();
  if (!body?.messages?.length) return c.json({ error: 'Missing messages' }, 400);

  const libraryPath = getLibraryPath();
  const categories = ['pocket-rules', 'mini-book', 'self-learning', 'user-style'];
  const bookList: string[] = [];
  for (const cat of categories) {
    const catPath = join(libraryPath, cat);
    if (existsSync(catPath)) {
      readdirSync(catPath).filter((f) => f.endsWith('.md')).forEach((f) => bookList.push(`${cat}/${f}`));
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
- Give exact terminal commands (git clone, npm install, etc.)
- Help plan projects using the user's proven patterns
- Tell the user exactly which repos to clone and why

WHEN ASKED TO "DOWNLOAD A REPO":
Give the exact command: git clone <url>
Do NOT say you cannot download — give the command and tell them to run it.

WHEN ASKED ABOUT YOUR CAPABILITIES:
Explain what you ARE (a local library AI with their knowledge) not what you aren't.
${taskSection}`;

  const messages = [{ role: 'system' as const, content: systemPrompt }, ...body.messages];
  const response = await routeChat(messages);
  return c.json(response);
});

app.get('/config', (c) => {
  const config = loadConfig();
  // Mask API keys: show only first 4 chars + ***
  const masked = {
    ...config,
    ai_backends: config.ai_backends.map((b) => ({
      ...b,
      apiKey: b.apiKey ? b.apiKey.slice(0, 4) + '***' : undefined,
    })),
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

export function startServer(port = 8765): void {
  serve({ fetch: app.fetch, port }, () => {
    console.log(`BuilderBrain running at http://localhost:${port}`);
    console.log(`Dashboard: http://localhost:${port}`);
    console.log(`API: http://localhost:${port}/status`);
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
