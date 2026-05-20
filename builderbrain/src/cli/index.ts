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

const program = new Command();
const VERSION = '2.0.0';

program.name('brain').description('BuilderBrain — local-first AI engineering brain').version(VERSION);

function getLibraryPath(): string {
  return join(process.cwd(), 'brain-data', 'library');
}

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
Version:        ${VERSION}
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
  .action(async (opts) => {
    const port = Number(opts.port);
    console.log(`Starting BuilderBrain API on port ${port}...`);
    const { startServer } = await import('../api/index.js');
    startServer(port);
  });

program.parse(process.argv);
