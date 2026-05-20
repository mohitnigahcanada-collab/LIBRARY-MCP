import { join } from 'path';
import { classifyDomains } from '../engines/classifier.js';
import { selectBookStack } from '../engines/bookRouter.js';
import { assessRisk, assessConfidence } from '../engines/riskConfidence.js';
import { buildContextPack, formatContextPack } from '../engines/contextPackBuilder.js';
import { buildProposal, formatProposal } from '../engines/proposalEngine.js';
import { saveLesson, hasPriorLessons } from '../memory/selfLearning.js';
import { saveRunLog } from '../logger.js';
import { readdirSync, existsSync } from 'fs';

function getLibraryPath(): string {
  return join(process.cwd(), 'brain-data', 'library');
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
        version: '1.0.0',
        status: 'ok',
        books: bookCount,
        runs: runCount,
        hasPriorLessons: hasPriorLessons(),
        categories: categoryStats,
      };
    },
  },
];

export function getMCPTool(name: string): MCPTool | undefined {
  return mcpTools.find((t) => t.name === name);
}
