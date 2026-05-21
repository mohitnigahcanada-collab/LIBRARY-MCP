#!/usr/bin/env node
import { Command } from 'commander';
import { join } from 'path';
import { classifyDomains } from '../engines/classifier.js';
import { selectBookStack } from '../engines/bookRouter.js';
import { assessRisk, assessConfidence } from '../engines/riskConfidence.js';
import { buildContextPack, formatContextPack } from '../engines/contextPackBuilder.js';
import { buildProposal, formatProposal } from '../engines/proposalEngine.js';
import { saveLesson, hasPriorLessons } from '../memory/selfLearning.js';
import { saveRunLog, listRunLogs } from '../logger.js';
import { readdirSync, existsSync, mkdirSync } from 'fs';
import { createInterface } from 'readline';
import { getAppVersion } from '../version.js';
import { getLibraryPath } from '../storage/paths.js';
import {
  addRepo,
  listRepos,
  repoDetails,
  analyzeRepo,
  scoreRepoCard,
  digestRepo,
  acceptRepo,
  expandLibraryByCategory,
  compressCategoryMiniBook,
  importReposFromMarkdown,
} from '../repos/service.js';
import { ensureCategoriesFile } from '../repos/categories.js';

const program = new Command();
const APP_VERSION = getAppVersion();

program.name('brain').description('BuilderBrain — local-first AI engineering brain').version(APP_VERSION);

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

program
  .command('context <task>')
  .description('Build a context pack for a task')
  .action((task: string) => {
    const domains = classifyDomains(task);
    const bookStack = selectBookStack(domains);
    const risk = assessRisk(task, domains);
    const confidence = assessConfidence(task, domains, hasPriorLessons());
    const libraryPath = getLibraryPath();
    const pack = buildContextPack(task, domains, bookStack, risk, confidence, libraryPath);

    saveRunLog({
      command: 'context',
      input: task,
      detectedDomains: domains,
      booksUsed: bookStack.map((b) => b.label),
      risk: risk.level,
      confidence: confidence.level,
      summary: `Context pack built for: ${task.slice(0, 80)}`,
    });

    console.log(formatContextPack(pack));
  });

program
  .command('propose <task>')
  .description('Generate a proposal with risk and confidence assessment')
  .action((task: string) => {
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
      summary: `Proposal generated for: ${task.slice(0, 80)}`,
    });

    console.log(formatProposal(proposal));
  });

program
  .command('learn')
  .description('Save a lesson to self-learning memory')
  .action(async () => {
    console.log('BuilderBrain — Save a Lesson\n');
    const task = await prompt('Task (what were you building?): ');
    const problem = await prompt('Problem (what went wrong?): ');
    const rootCause = await prompt('Root cause (why did it happen?): ');
    const solution = await prompt('Solution (what fixed it?): ');
    const evidence = await prompt('Evidence (how do you know it works?): ');

    saveLesson({ task, problem, rootCause, solution, evidence });

    saveRunLog({
      command: 'learn',
      input: task,
      detectedDomains: [],
      booksUsed: [],
      risk: 'Low',
      confidence: 'High',
      summary: `Lesson saved: ${task.slice(0, 80)}`,
    });

    console.log('\n✅ Lesson saved to self-learning memory.');
  });

program
  .command('status')
  .description('Show BuilderBrain system status')
  .action(() => {
    const libraryPath = getLibraryPath();
    const runsPath = join(process.cwd(), 'brain-data', 'runs');

    let bookCount = 0;
    const categories = ['pocket-rules', 'mini-book', 'self-learning', 'user-style'];
    for (const cat of categories) {
      const catPath = join(libraryPath, cat);
      if (existsSync(catPath)) {
        bookCount += readdirSync(catPath).filter((f) => f.endsWith('.md')).length;
      }
    }

    const runCount = existsSync(runsPath) ? readdirSync(runsPath).filter((f) => f.endsWith('.json')).length : 0;
    const lessonsExist = hasPriorLessons();

    console.log(`
BuilderBrain Status
═══════════════════
Version:        ${APP_VERSION}
Library path:   ${libraryPath}
Books loaded:   ${bookCount} files
Run logs:       ${runCount}
Self-learning:  ${lessonsExist ? '✅ Has prior lessons' : '⚪ No lessons yet'}

Categories:
${categories
  .map((cat) => {
    const catPath = join(libraryPath, cat);
    const count = existsSync(catPath) ? readdirSync(catPath).filter((f) => f.endsWith('.md')).length : 0;
    return `  ${cat.padEnd(20)} ${count} files`;
  })
  .join('\n')}
`);
  });

program
  .command('books')
  .description('List all available knowledge books')
  .action(() => {
    const libraryPath = getLibraryPath();
    const categories = ['pocket-rules', 'mini-book', 'self-learning', 'user-style'];

    console.log('BuilderBrain Knowledge Library\n');
    for (const cat of categories) {
      const catPath = join(libraryPath, cat);
      if (!existsSync(catPath)) continue;
      const files = readdirSync(catPath).filter((f) => f.endsWith('.md'));
      console.log(`📚 ${cat}`);
      for (const file of files) {
        console.log(`   - ${file}`);
      }
      console.log();
    }
  });

program
  .command('runs')
  .description('List recent run logs')
  .option('-n, --limit <number>', 'Number of runs to show', '10')
  .action((opts) => {
    const logs = listRunLogs(Number(opts.limit));
    if (logs.length === 0) {
      console.log('No run logs yet.');
      return;
    }
    console.log('Recent Runs\n');
    for (const log of logs) {
      console.log(`[${log.timestamp.split('T')[0]}] ${log.command.padEnd(10)} Risk: ${log.risk.padEnd(8)} Conf: ${log.confidence.padEnd(6)} — ${log.summary}`);
    }
  });

program
  .command('init')
  .description('Initialize brain-data folder structure')
  .action(() => {
    const base = join(process.cwd(), 'brain-data');
    const dirs = [
      'library/pocket-rules',
      'library/mini-book',
      'library/self-learning',
      'library/user-style',
      'runs',
    ];
    for (const dir of dirs) {
      mkdirSync(join(base, dir), { recursive: true });
    }
    console.log('✅ brain-data/ folder structure initialized.');
  });

program
  .command('serve')
  .description('Start the BuilderBrain local API server')
  .option('-p, --port <number>', 'Port to listen on', '8765')
  .option('-H, --host <host>', 'Host to bind to', '127.0.0.1')
  .action(async (opts) => {
    const port = Number(opts.port);
    const host = String(opts.host);
    console.log(`Starting BuilderBrain API on ${host}:${port}...`);
    const { startServer } = await import('../api/index.js');
    startServer(port, host);
  });

const repo = program.command('repo').description('Safe repo intelligence commands');

repo
  .command('add <url>')
  .description('Add a GitHub repository into quarantine')
  .option('--topic <topic>', 'Category/topic tag', 'general')
  .action((url: string, opts: { topic: string }) => {
    const result = addRepo(url, opts.topic);
    console.log(result.message);
    if (!result.success) process.exitCode = 1;
  });

repo
  .command('list')
  .description('List tracked repos')
  .action(() => {
    const repos = listRepos();
    if (repos.length === 0) {
      console.log('No repos tracked yet.');
      return;
    }
    for (const r of repos) {
      console.log(`${r.id}  [${r.status}]  topic=${r.topic}  updated=${r.updatedAt}`);
    }
  });

repo
  .command('show <repoId>')
  .description('Show repo metadata, score, risk, and summary paths')
  .action((repoId: string) => {
    const details = repoDetails(repoId);
    if (!details) {
      console.error(`Repo not found: ${repoId}`);
      process.exitCode = 1;
      return;
    }
    console.log(JSON.stringify(details, null, 2));
  });

repo
  .command('analyze <repoId>')
  .description('Analyze repo (metadata + license + risk + score + summary)')
  .action((repoId: string) => {
    const result = analyzeRepo(repoId);
    console.log(result.message);
    if (!result.success) process.exitCode = 1;
  });

repo
  .command('score <repoId>')
  .description('Print repo scorecard')
  .action((repoId: string) => {
    const score = scoreRepoCard(repoId);
    if (!score) {
      console.error(`Repo not found or cannot score: ${repoId}`);
      process.exitCode = 1;
      return;
    }
    console.log(JSON.stringify(score, null, 2));
  });

repo
  .command('digest <repoId>')
  .description('Generate safe digest (no code execution)')
  .action((repoId: string) => {
    const result = digestRepo(repoId);
    console.log(result.message);
    if (!result.success) process.exitCode = 1;
  });

repo
  .command('accept <repoId>')
  .description('Accept analyzed repo into accepted library')
  .action((repoId: string) => {
    const result = acceptRepo(repoId);
    console.log(result.message);
    if (!result.success) process.exitCode = 1;
  });

const library = program.command('library').description('World library expansion tools');

library
  .command('expand')
  .description('Expand research library from GitHub safely')
  .requiredOption('--category <category>', 'Category id (or "all")')
  .option('--most-starred <n>', 'Most-starred candidate count', '10')
  .option('--fresh <n>', 'Fresh/trending candidate count', '5')
  .option('--safe', 'Safe mode (default true)', true)
  .action(async (opts: { category: string; mostStarred: string; fresh: string; safe: boolean }) => {
    const categories = ensureCategoriesFile();
    const targets = opts.category === 'all' ? categories.map((c) => c.id) : [opts.category];
    for (const category of targets) {
      const result = await expandLibraryByCategory({
        category,
        mostStarred: Number(opts.mostStarred),
        fresh: Number(opts.fresh),
        safe: opts.safe,
      });
      console.log(`[${category}] ${result.message}`);
      if (!result.success) process.exitCode = 1;
    }
  });

library
  .command('compress')
  .description('Compress category knowledge into a mini-book')
  .requiredOption('--category <category>', 'Category id')
  .action((opts: { category: string }) => {
    const result = compressCategoryMiniBook(opts.category);
    console.log(result.message);
    if (!result.success) process.exitCode = 1;
  });

library
  .command('import-md')
  .description('Import GitHub repos found in markdown file/text')
  .option('--file <path>', 'Path to markdown file')
  .option('--topic <topic>', 'Topic tag for imported repos', 'general')
  .option('--no-analyze', 'Disable auto analysis after add')
  .action((opts: { file?: string; topic: string; analyze: boolean }) => {
    if (!opts.file) {
      console.error('Missing --file path')
      process.exitCode = 1
      return
    }
    const result = importReposFromMarkdown({
      filePath: opts.file,
      topic: opts.topic,
      autoAnalyze: opts.analyze,
    })
    console.log(result.message)
    if (!result.success) process.exitCode = 1
  });

program.parse(process.argv);
