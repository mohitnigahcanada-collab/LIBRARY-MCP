import { join } from 'path';
import { classifyDomains } from '../engines/classifier.js';
import { selectBookStack } from '../engines/bookRouter.js';
import { assessRisk, assessConfidence } from '../engines/riskConfidence.js';
import { buildContextPack, formatContextPack } from '../engines/contextPackBuilder.js';
import { buildProposal, formatProposal } from '../engines/proposalEngine.js';
import { saveLesson, hasPriorLessons } from '../memory/selfLearning.js';
import { saveRunLog } from '../logger.js';
import { readdirSync, existsSync } from 'fs';
import { getAppVersion } from '../version.js';
import { routeChat, routeChatEnsemble } from '../engines/aiRouter.js';
import { getLibraryPath as getConfiguredLibraryPath } from '../storage/paths.js';
import {
  addRepo,
  listRepos,
  analyzeRepo,
  scoreRepoCard,
  digestRepo,
  acceptRepo,
} from '../repos/service.js';

const APP_VERSION = getAppVersion();

function getLibraryPath(): string {
  return getConfiguredLibraryPath();
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: object;
  execute: (input: Record<string, unknown>) => Promise<unknown>;
}

export const mcpTools: MCPTool[] = [
  {
    name: 'brain_context_pack',
    description: 'Build a full context pack for a task — classifies domains, selects book stack, assesses risk and confidence',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'The task or question to build context for' },
      },
      required: ['task'],
    },
    execute: async (input) => {
      const task = input.task as string;
      const domains = classifyDomains(task);
      const bookStack = selectBookStack(domains);
      const risk = assessRisk(task, domains);
      const confidence = assessConfidence(task, domains, hasPriorLessons());
      const pack = buildContextPack(task, domains, bookStack, risk, confidence, getLibraryPath());

      saveRunLog({
        command: 'mcp:context',
        input: task,
        detectedDomains: domains,
        booksUsed: bookStack.map((b) => b.label),
        risk: risk.level,
        confidence: confidence.level,
        summary: `Context pack built via MCP for: ${task.slice(0, 80)}`,
      });

      return { formatted: formatContextPack(pack), raw: pack };
    },
  },

  {
    name: 'brain_propose',
    description: 'Generate a proposal with risk assessment, confidence score, planned actions, and rollback plan',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'The task to generate a proposal for' },
      },
      required: ['task'],
    },
    execute: async (input) => {
      const task = input.task as string;
      const domains = classifyDomains(task);
      const bookStack = selectBookStack(domains);
      const risk = assessRisk(task, domains);
      const confidence = assessConfidence(task, domains, hasPriorLessons());
      const proposal = buildProposal(task, domains, bookStack, risk, confidence);

      saveRunLog({
        command: 'mcp:propose',
        input: task,
        detectedDomains: domains,
        booksUsed: bookStack.map((b) => b.label),
        risk: risk.level,
        confidence: confidence.level,
        summary: `Proposal generated via MCP for: ${task.slice(0, 80)}`,
      });

      return { formatted: formatProposal(proposal), raw: proposal };
    },
  },

  {
    name: 'brain_save_lesson',
    description: 'Save a lesson to self-learning memory — records task, problem, root cause, solution, and evidence',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'What was being built' },
        problem: { type: 'string', description: 'What went wrong' },
        rootCause: { type: 'string', description: 'Why it happened' },
        solution: { type: 'string', description: 'What fixed it' },
        evidence: { type: 'string', description: 'How you know it works' },
      },
      required: ['task', 'problem', 'rootCause', 'solution', 'evidence'],
    },
    execute: async (input) => {
      const lesson = {
        task: input.task as string,
        problem: input.problem as string,
        rootCause: input.rootCause as string,
        solution: input.solution as string,
        evidence: input.evidence as string,
      };

      saveLesson(lesson);

      saveRunLog({
        command: 'mcp:learn',
        input: lesson.task,
        detectedDomains: [],
        booksUsed: [],
        risk: 'Low',
        confidence: 'High',
        summary: `Lesson saved via MCP: ${lesson.task.slice(0, 80)}`,
      });

      return { success: true, message: 'Lesson saved to self-learning memory' };
    },
  },

  {
    name: 'brain_status',
    description: 'Get BuilderBrain system status — book count, run count, self-learning status',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: async () => {
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

      return {
        version: APP_VERSION,
        status: 'ok',
        books: bookCount,
        runs: runCount,
        hasPriorLessons: hasPriorLessons(),
        categories: categoryStats,
      };
    },
  },

  {
    name: 'brain_repo_add',
    description: 'Add a GitHub repo into quarantine and create metadata',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        topic: { type: 'string' },
      },
      required: ['url'],
    },
    execute: async (input) => addRepo(String(input.url), String(input.topic ?? 'general')),
  },

  {
    name: 'brain_repo_list',
    description: 'List all tracked repos with status/topic',
    inputSchema: { type: 'object', properties: {}, required: [] },
    execute: async () => listRepos(),
  },

  {
    name: 'brain_repo_analyze',
    description: 'Analyze repo safely (metadata/license/risk/score/summary)',
    inputSchema: {
      type: 'object',
      properties: { repoId: { type: 'string' } },
      required: ['repoId'],
    },
    execute: async (input) => analyzeRepo(String(input.repoId)),
  },

  {
    name: 'brain_repo_score',
    description: 'Get repo scorecard',
    inputSchema: {
      type: 'object',
      properties: { repoId: { type: 'string' } },
      required: ['repoId'],
    },
    execute: async (input) => {
      const score = scoreRepoCard(String(input.repoId));
      return score ?? { error: 'Repo not found' };
    },
  },

  {
    name: 'brain_repo_digest',
    description: 'Create safe repo digest',
    inputSchema: {
      type: 'object',
      properties: { repoId: { type: 'string' } },
      required: ['repoId'],
    },
    execute: async (input) => digestRepo(String(input.repoId)),
  },

  {
    name: 'brain_repo_accept',
    description: 'Accept analyzed repo into trusted folder',
    inputSchema: {
      type: 'object',
      properties: { repoId: { type: 'string' } },
      required: ['repoId'],
    },
    execute: async (input) => acceptRepo(String(input.repoId)),
  },

  {
    name: 'brain_chat',
    description: 'Ask BuilderBrain chat backend directly.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
      required: ['message'],
    },
    execute: async (input) => {
      const message = String(input.message ?? '');
      const result = await routeChat([{ role: 'user', content: message }]);
      return result;
    },
  },

  {
    name: 'brain_chat_ensemble',
    description: 'Run 3-AI BuilderBrain debate and return merged answer + members.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        count: { type: 'number' },
      },
      required: ['message'],
    },
    execute: async (input) => {
      const message = String(input.message ?? '');
      const count = Number(input.count ?? 3);
      const result = await routeChatEnsemble([{ role: 'user', content: message }], { count });
      return result;
    },
  },
];

export function getMCPTool(name: string): MCPTool | undefined {
  return mcpTools.find((t) => t.name === name);
}
