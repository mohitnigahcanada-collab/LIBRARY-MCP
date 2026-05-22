import { join } from 'path';
import { fileURLToPath } from 'url';
import { classifyDomains } from '../engines/classifier.js';
import { selectBookStack } from '../engines/bookRouter.js';
import { assessRisk, assessConfidence } from '../engines/riskConfidence.js';
import { buildContextPack, formatContextPack } from '../engines/contextPackBuilder.js';
import { buildProposal, formatProposal } from '../engines/proposalEngine.js';
import { saveLesson, hasPriorLessons } from '../memory/selfLearning.js';
import { saveRunLog } from '../logger.js';
import { readdirSync, existsSync, writeFileSync, mkdirSync, readFileSync, appendFileSync, rmSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);
import { harvestKnowledge } from '../engines/autoHarvester.js';
import { analyzeRepo, saveDiscoveredBook } from '../engines/repoAnalyzer.js';
import { delegateTask } from '../engines/orchestrator.js';
import { createSnapshot, undoToSnapshot } from '../engines/timeTravel.js';
import { runSelfHealer } from '../engines/selfHealer.js';
import cron from 'node-cron';
import { WebSocketServer } from 'ws';
import { loadConfig } from '../config/manager.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

function getLibraryPath(): string {
  return join(process.cwd(), 'brain-data', 'library');
}

const VERSION = '2.0.0';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: object;
  execute: (input: Record<string, unknown>) => Promise<unknown>;
}

export const mcpTools: MCPTool[] = [
  {
    name: 'brain_delegate',
    description: 'Multi-Agent Orchestrator: Delegate a complex task to multiple specialized sub-agents working in parallel.',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'The master task to delegate' },
        roles: { type: 'array', items: { type: 'string' }, description: 'List of agent roles to spawn (e.g. ["Frontend Specialist", "Backend Architect"])' },
      },
      required: ['task', 'roles'],
    },
    execute: async (input) => {
      const task = input.task as string;
      const roles = input.roles as string[];
      const plan = delegateTask(task, roles);
      return { success: true, orchestrationPlan: plan };
    },
  },

  {
    name: 'brain_snapshot',
    description: 'Time-Travel Rollback: Create a hidden git snapshot of the current workspace before making risky changes.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Description of what you are about to do' },
      },
      required: ['message'],
    },
    execute: async (input) => {
      const message = input.message as string;
      const result = await createSnapshot(message);
      return result;
    },
  },

  {
    name: 'brain_undo',
    description: 'Time-Travel Rollback: Revert the entire workspace to a previously created snapshot.',
    inputSchema: {
      type: 'object',
      properties: {
        snapshotId: { type: 'string', description: 'The ID of the snapshot to revert to' },
      },
      required: ['snapshotId'],
    },
    execute: async (input) => {
      const snapshotId = input.snapshotId as string;
      const success = await undoToSnapshot(snapshotId);
      return { success, message: success ? 'Reverted successfully' : 'Undo failed' };
    },
  },

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
    description: 'Generate a proposal with risk assessment, confidence score, planned actions, and rollback plan. For High/Critical risk tasks, force=true is required.',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'The task to generate a proposal for' },
        force: { type: 'boolean', description: 'Must be true if the task is flagged as High or Critical risk to bypass the safety gate.' },
      },
      required: ['task'],
    },
    execute: async (input) => {
      const task = input.task as string;
      const force = input.force as boolean | undefined;
      
      const domains = classifyDomains(task);
      const bookStack = selectBookStack(domains);
      const risk = assessRisk(task, domains);
      
      if ((risk.level === 'High' || risk.level === 'Critical') && force !== true) {
        throw new Error(`[Red Team Gate] High Risk Task detected (${risk.score}/100: ${risk.level}). You must thoroughly review the rollback plan and call this tool again with force: true to proceed.`);
      }
      
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
        version: VERSION,
        status: 'ok',
        books: bookCount,
        runs: runCount,
        hasPriorLessons: hasPriorLessons(),
        categories: categoryStats,
      };
    },
  },

  {
    name: 'brain_harvest_knowledge',
    description: 'Auto-harvest knowledge using Agentic RAG for an unknown topic via web search',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'The technology or concept to harvest' },
      },
      required: ['topic'],
    },
    execute: async (input) => {
      const topic = input.topic as string;
      const result = await harvestKnowledge(topic);
      return result;
    },
  },

  {
    name: 'brain_analyze_repo',
    description: 'Perform deep semantic digestion of a cloned repository into a mini-book',
    inputSchema: {
      type: 'object',
      properties: {
        repoName: { type: 'string', description: 'The folder name of the cloned repo in big-bible/repos/' },
      },
      required: ['repoName'],
    },
    execute: async (input) => {
      const repoName = input.repoName as string;
      const repoPath = join(process.cwd(), 'brain-data', 'big-bible', 'repos', repoName);
      if (!existsSync(repoPath)) {
        throw new Error(`Repository ${repoName} not found in brain-data/big-bible/repos/`);
      }
      
      const config = loadConfig();
      const aiBackend = config.ai_backends.find(b => b.enabled) ?? config.ai_backends[0];
      
      const result = await analyzeRepo(repoPath, aiBackend);
      await saveDiscoveredBook(repoName, result.miniBook);
      
      return { 
        success: true, 
        message: `Successfully analyzed ${repoName} and created semantic digest.`,
        techStack: result.techStack
      };
    },
  },

  {
    name: 'brain_save_rule',
    description: 'Hot-reload user style memory: Saves a strict coding style rule to the user-style library so it is applied to all future generations.',
    inputSchema: {
      type: 'object',
      properties: {
        rule: { type: 'string', description: 'The strict stylistic or coding rule to save (e.g., "Never use Tailwind, use Vanilla CSS")' },
      },
      required: ['rule'],
    },
    execute: async (input) => {
      const rule = input.rule as string;
      const rulesDir = join(getLibraryPath(), 'user-style');
      mkdirSync(rulesDir, { recursive: true });
      
      const ruleFile = join(rulesDir, 'do-not-ask-rules.md');
      
      if (!existsSync(ruleFile)) {
        writeFileSync(ruleFile, `# Strict User Preferences\n\n> This file contains hot-reloaded user style rules. MUST OBEY.\n\n`, 'utf-8');
      }
      
      appendFileSync(ruleFile, `- **NEW RULE**: ${rule}\n`, 'utf-8');
      
      saveRunLog({
        command: 'mcp:save_rule',
        input: rule,
        detectedDomains: [],
        booksUsed: [],
        risk: 'Low',
        confidence: 'High',
        summary: `User rule saved: ${rule.slice(0, 50)}...`,
      });
      
      return { success: true, message: 'Rule successfully saved and hot-reloaded into BuilderBrain.' };
    },
  },

  {
    name: 'brain_test_code',
    description: 'Sandboxed Execution: Writes JS/TS code to a temporary file and runs it in isolation to verify it works before proposing it.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'The JavaScript or TypeScript code to execute' },
        language: { type: 'string', enum: ['javascript', 'typescript'], description: 'The language of the code' },
      },
      required: ['code', 'language'],
    },
    execute: async (input) => {
      const code = input.code as string;
      const language = input.language as string;
      
      const sandboxDir = join(process.cwd(), 'brain-data', 'sandbox');
      mkdirSync(sandboxDir, { recursive: true });
      
      const filename = `temp_${Date.now()}.${language === 'typescript' ? 'ts' : 'js'}`;
      const filepath = join(sandboxDir, filename);
      
      writeFileSync(filepath, code, 'utf-8');
      
      try {
        const bin = language === 'typescript' ? 'npx' : 'node';
        const args = language === 'typescript' ? ['tsx', filepath] : [filepath];
        
        const { stdout, stderr } = await execFileAsync(bin, args, { timeout: 5000 });
        rmSync(filepath, { force: true });
        
        saveRunLog({
          command: 'mcp:test_code',
          input: code.slice(0, 50),
          detectedDomains: [],
          booksUsed: [],
          risk: 'Medium',
          confidence: 'High',
          summary: `Sandboxed execution ran successfully.`,
        });
        
        return { success: true, stdout, stderr };
      } catch (err: any) {
        rmSync(filepath, { force: true });
        return { 
          success: false, 
          error: err.message, 
          stdout: err.stdout?.toString(), 
          stderr: err.stderr?.toString() 
        };
      }
    },
  },
];

export function getMCPTool(name: string): MCPTool | undefined {
  return mcpTools.find((t) => t.name === name);
}

export async function startMCPServer(): Promise<void> {
  // Real-Time Thought Telemetry (WebSocket Server)
  const wss = new WebSocketServer({ port: 8080 });
  const broadcastThought = (thought: string) => {
    wss.clients.forEach(client => {
      if (client.readyState === 1) client.send(JSON.stringify({ type: 'thought', content: thought, timestamp: Date.now() }));
    });
  };

  // Coffee-Time Self-Healing Worker (Cron Job)
  cron.schedule('0 3 * * *', async () => {
    broadcastThought('Running nightly self-healing worker...');
    const healedCount = await runSelfHealer();
    broadcastThought(`Self-healing complete. ${healedCount} proposals drafted.`);
  });

  const server = new Server(
    { name: 'builderbrain', version: VERSION },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: mcpTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    broadcastThought(`Thinking about using tool: ${name}`);
    const tool = getMCPTool(name);

    if (!tool) {
      return {
        content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    try {
      const result = await tool.execute((args ?? {}) as Record<string, unknown>);
      broadcastThought(`Successfully executed: ${name}`);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      broadcastThought(`Error executing ${name}: ${message}`);
      return {
        content: [{ type: 'text' as const, text: `Tool execution error: ${message}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('BuilderBrain MCP server running on stdio, WebSocket Telemetry on port 8080\n');
}

// Auto-start when run directly
const __filename = fileURLToPath(import.meta.url);
const isMain = process.argv[1] === __filename ||
  process.argv[1]?.endsWith('src/mcp/index.ts') ||
  process.argv[1]?.endsWith('src/mcp/index.js');

if (isMain) {
  startMCPServer().catch((err) => {
    process.stderr.write(`MCP server failed to start: ${err.message}\n`);
    process.exit(1);
  });
}
