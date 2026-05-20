import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { join, relative, resolve } from 'path';
import { readdirSync, existsSync, readFileSync, mkdirSync, statSync } from 'fs';
import { execFileSync } from 'child_process';
import { classifyDomains } from '../engines/classifier.js';
import { selectBookStack } from '../engines/bookRouter.js';
import { assessRisk, assessConfidence } from '../engines/riskConfidence.js';
import { buildContextPack } from '../engines/contextPackBuilder.js';
import { buildProposal } from '../engines/proposalEngine.js';
import { saveLesson, hasPriorLessons } from '../memory/selfLearning.js';
import { saveRunLog, listRunLogs, getRunLog } from '../logger.js';
import { loadConfig, saveConfig, mergeConfigUpdate, type Config } from '../config/manager.js';
import { routeChat, type ChatMessage } from '../engines/aiRouter.js';
import { sendAlert } from '../engines/alerts.js';

const app = new Hono();
const VERSION = '2.0.0';
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

// CORS middleware
app.use('/*', async (c, next) => {
  await next();
  const origin = c.req.header('Origin');
  if (origin && LOCAL_ORIGIN.test(origin)) {
    c.header('Access-Control-Allow-Origin', origin);
  }
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
});

app.options('/*', (c) => new Response('', { status: 204 }));

function getLibraryPath(): string {
  return join(process.cwd(), 'brain-data', 'library');
}

function resolveInside(basePath: string, requestedPath: string): string | null {
  const base = resolve(basePath);
  const target = resolve(base, requestedPath);
  const rel = relative(base, target);
  if (rel.startsWith('..') || rel === '..' || resolve(rel) === rel) return null;
  return target;
}

function isValidRunId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

app.get('/health', (c) => {
  return c.json({ ok: true, version: VERSION });
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
    version: VERSION,
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

  const resolved = resolveInside(getLibraryPath(), bookPath);
  if (!resolved || !bookPath.endsWith('.md')) return c.json({ error: 'Invalid book path' }, 400);
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
  const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 10) || 10, 1), 100);
  return c.json(listRunLogs(limit));
});

app.get('/runs/:id', (c) => {
  const id = c.req.param('id');
  if (!isValidRunId(id)) return c.json({ error: 'Invalid run id' }, 400);
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

// ── Repo clone ────────────────────────────────────────────────────────────────

function getRepoBrainPath(): string {
  return join(process.cwd(), 'brain-data', 'big-bible', 'repos');
}

function parseGitHubRepoUrl(url: string): { cleanUrl: string; repoName: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }

  if (!['https:', 'http:'].includes(parsed.protocol)) return null;
  if (parsed.hostname !== 'github.com' && parsed.hostname !== 'www.github.com') return null;
  if (parsed.search || parsed.hash) return null;

  const parts = parsed.pathname.replace(/^\/|\/$/g, '').split('/');
  if (parts.length !== 2) return null;

  const [owner, rawRepo] = parts;
  const repoName = rawRepo.replace(/\.git$/, '');
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repoName)) return null;

  return {
    cleanUrl: `https://github.com/${owner}/${repoName}.git`,
    repoName,
  };
}

function cloneRepo(url: string): { success: boolean; repoName: string; path: string; message: string } {
  const parsed = parseGitHubRepoUrl(url);
  if (!parsed) {
    return { success: false, repoName: '', path: '', message: 'Only direct GitHub repository URLs are supported' };
  }

  const { cleanUrl, repoName } = parsed;
  const reposDir = getRepoBrainPath();
  const targetPath = join(reposDir, repoName);

  mkdirSync(reposDir, { recursive: true });

  if (existsSync(targetPath)) {
    return { success: true, repoName, path: targetPath, message: `Already in library: ${repoName}` };
  }

  try {
    execFileSync('git', ['clone', '--depth=1', cleanUrl, targetPath], { timeout: 120_000, stdio: 'pipe' });
    return { success: true, repoName, path: targetPath, message: `Cloned ${repoName} → brain-data/big-bible/repos/${repoName}` };
  } catch (err: any) {
    return { success: false, repoName, path: targetPath, message: `Clone failed: ${err.message ?? String(err)}` };
  }
}

app.post('/repo/clone', async (c) => {
  const body = await c.req.json<{ url: string }>();
  if (!body?.url) return c.json({ error: 'Missing url' }, 400);
  if (!parseGitHubRepoUrl(body.url)) return c.json({ error: 'Only direct GitHub repository URLs are supported' }, 400);
  const result = cloneRepo(body.url);
  if (result.success) {
    sendAlert(`🧠 <b>BuilderBrain</b>\nRepo cloned: <code>${result.repoName}</code>\nSaved to: brain-data/big-bible/repos/${result.repoName}`).catch(() => {});
  }
  return c.json(result, result.success ? 200 : 500);
});

app.post('/alert/test', async (c) => {
  const result = await sendAlert('🧠 <b>BuilderBrain</b>\nAlert test — connected successfully!');
  return c.json(result);
});

app.get('/repos', (c) => {
  const reposDir = getRepoBrainPath();
  if (!existsSync(reposDir)) return c.json([]);
  const repos = readdirSync(reposDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({ name: d.name, path: join(reposDir, d.name) }));
  return c.json(repos);
});

// ── Chat ──────────────────────────────────────────────────────────────────────

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

  // Auto-detect repo clone intent in the last user message
  let cloneNote = '';
  const lastMsg = body.messages[body.messages.length - 1]?.content ?? '';
  const githubUrl = lastMsg.match(/https?:\/\/(?:www\.)?github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?/i)?.[0];
  const cloneIntent = /\b(clone|download|add|get|fetch|grab|save|pull)\b/i.test(lastMsg);
  if (githubUrl && cloneIntent) {
    const result = cloneRepo(githubUrl);
    cloneNote = `\n\nACTION TAKEN: ${result.message}`;
    if (result.success) {
      cloneNote += `\nRepo is now saved at brain-data/big-bible/repos/${result.repoName} on the user's machine.`;
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
  const response = await routeChat(messages);
  return c.json(response);
});

// ── Discover Mode (v3 AI Layer) ──────────────────────────────────────────────

// Trend scanning cache
let trendScanCache: any[] = [];
let lastTrendScan: string | null = null;

app.post('/discover/scan', async (c) => {
  try {
    const { scanTrends } = await import('../engines/trendRadar.js');
    const config = loadConfig();
    
    const trendConfig = {
      githubToken: config.trend_radar?.github_token,
      braveApiKey: config.trend_radar?.brave_api_key,
      minStars: config.trend_radar?.min_stars ?? 100,
      languages: config.trend_radar?.languages ?? ['TypeScript', 'JavaScript'],
      topics: config.trend_radar?.topics ?? ['ai', 'mcp'],
      timeWindowDays: 7,
      maxResults: 20,
      enableBraveSearch: !!config.trend_radar?.brave_api_key,
    };
    
    const results = await scanTrends(trendConfig);
    trendScanCache = results;
    lastTrendScan = new Date().toISOString();
    
    sendAlert(`🔍 TrendRadar Scan Complete\nFound ${results.length} trending repos`).catch(() => {});
    
    return c.json({ success: true, reposFound: results.length });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.get('/discover/trending', (c) => {
  return c.json(trendScanCache.map(r => ({
    name: r.fullName,
    url: r.url,
    stars: r.stars,
    language: r.language ?? 'Unknown',
    description: r.description ?? '',
    topics: r.topics ?? [],
  })));
});

app.post('/discover/analyze', async (c) => {
  try {
    const body = await c.req.json<{ url: string }>();
    if (!body?.url) return c.json({ error: 'Missing url' }, 400);
    
    const { analyzeRepo } = await import('../engines/repoAnalyzer.js');
    const config = loadConfig();
    const aiBackend = config.ai_backends.find(b => b.enabled) ?? config.ai_backends[0];

    if (!aiBackend) {
      return c.json({ error: 'No AI backend configured. Add one in Settings → AI Backends.' }, 400);
    }

    // Extract repo name from URL
    const repoName = body.url.split('/').pop()?.replace(/\.git$/, '') ?? 'repo';
    const repoPath = join(process.cwd(), 'brain-data', 'big-bible', 'repos', repoName);

    if (!existsSync(repoPath)) {
      return c.json({ error: 'Repository not cloned yet. Clone it first.' }, 400);
    }

    const result = await analyzeRepo(repoPath, aiBackend);

    const techList = result.techStack?.languages?.join(', ') ?? 'unknown';
    sendAlert(`📊 Repo Analysis Complete\n${result.repoName}\nTech: ${techList}`).catch(() => {});
    
    return c.json({ success: true, analysis: result.miniBook });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.get('/discover/books', (c) => {
  const discoveredPath = join(process.cwd(), 'brain-data', 'library', 'discovered');
  
  if (!existsSync(discoveredPath)) {
    mkdirSync(discoveredPath, { recursive: true });
    return c.json([]);
  }
  
  const files = readdirSync(discoveredPath).filter(f => f.endsWith('.md'));
  const books = files.map(file => {
    const fullPath = join(discoveredPath, file);
    const stat = statSync(fullPath);
    return {
      title: file.replace(/\.md$/, '').replace(/-/g, ' '),
      path: `discovered/${file}`,
      category: 'auto-discovered',
      createdAt: stat.birthtime.toISOString(),
      size: Math.round(stat.size / 1024), // KB
    };
  });
  
  return c.json(books);
});

app.get('/discover/evolution', async (c) => {
  try {
    const { analyzeRunHistory } = await import('../engines/knowledgeEvolver.js');
    const config = loadConfig();
    
    const insight = await analyzeRunHistory(100, {
      minFrequency: config.knowledge_evolution?.min_pattern_count ?? 10,
    });
    
    const topPatterns = Array.from(insight.patternFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([pattern, count]) => ({ pattern, count }));
    
    return c.json({
      newKeywords: insight.newKeywords.size,
      patternFrequency: Object.fromEntries(insight.patternFrequency),
      lessonsCompressed: 0, // TODO: implement compression tracking
      lastEvolution: new Date().toISOString(),
      topPatterns,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post('/discover/evolution/apply', async (c) => {
  try {
    const { analyzeRunHistory, evolveLibrary } = await import('../engines/knowledgeEvolver.js');
    const config = loadConfig();
    
    const insight = await analyzeRunHistory(100, {
      minFrequency: config.knowledge_evolution?.min_pattern_count ?? 10,
    });
    
    await evolveLibrary(insight);
    
    const changes = `Updated ${insight.newKeywords.size} keywords, ` +
                    `${insight.suggestedBookUpdates.length} book suggestions`;
    
    sendAlert(`🧠 Knowledge Evolution Applied\n${changes}`).catch(() => {});
    
    return c.json({ success: true, changes });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.get('/discover/radar', (c) => {
  const config = loadConfig();
  
  return c.json({
    enabled: config.trend_radar?.enabled ?? false,
    nextScan: 'Not scheduled', // TODO: implement cron schedule reading
    lastScan: lastTrendScan ?? 'Never',
    scansToday: trendScanCache.length > 0 ? 1 : 0,
  });
});

app.post('/discover/radar/toggle', async (c) => {
  try {
    const body = await c.req.json<{ enabled: boolean }>();
    const config = loadConfig();
    
    config.trend_radar = config.trend_radar ?? {
      enabled: false,
      schedule_cron: '0 9 * * *',
      min_stars: 100,
      languages: ['TypeScript'],
      topics: ['ai'],
    };
    
    config.trend_radar.enabled = body.enabled;
    saveConfig(config);
    
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ── Config ────────────────────────────────────────────────────────────────────

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
  const body = await c.req.json<Partial<Config>>();
  if (!body) return c.json({ error: 'Missing config body' }, 400);

  const current = loadConfig();
  const updated = mergeConfigUpdate(current, body);
  saveConfig(updated);
  return c.json({ success: true, message: 'Config saved' });
});

// Serve dashboard static files if built
const dashboardPath = join(process.cwd(), 'dist', 'dashboard');
if (existsSync(dashboardPath)) {
  app.use('/*', serveStatic({ root: './dist/dashboard' }));
}

export function startServer(port = 8765): void {
  serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, () => {
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
