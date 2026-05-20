import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { join } from 'path';
import { readdirSync, existsSync, readFileSync } from 'fs';
import { classifyDomains } from '../engines/classifier.js';
import { selectBookStack } from '../engines/bookRouter.js';
import { assessRisk, assessConfidence } from '../engines/riskConfidence.js';
import { buildContextPack } from '../engines/contextPackBuilder.js';
import { buildProposal } from '../engines/proposalEngine.js';
import { saveLesson, hasPriorLessons } from '../memory/selfLearning.js';
import { saveRunLog, listRunLogs, getRunLog } from '../logger.js';

const app = new Hono();

function getLibraryPath(): string {
  return join(process.cwd(), 'brain-data', 'library');
}

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
    version: '1.0.0',
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

export function startServer(port = 3737): void {
  serve({ fetch: app.fetch, port }, () => {
    console.log(`BuilderBrain API running at http://localhost:${port}`);
  });
}

export default app;
