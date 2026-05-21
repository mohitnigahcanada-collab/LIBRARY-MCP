#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getMCPTool } from './index.js';
import { getAppVersion } from '../version.js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

type ToolName =
  | 'brain_context_pack'
  | 'brain_propose'
  | 'brain_save_lesson'
  | 'brain_status'
  | 'brain_repo_add'
  | 'brain_repo_list'
  | 'brain_repo_analyze'
  | 'brain_repo_score'
  | 'brain_repo_digest'
  | 'brain_repo_accept'
  | 'brain_chat'
  | 'brain_chat_ensemble';

function mcpText(text: string, isError = false) {
  return {
    content: [{ type: 'text' as const, text }],
    isError,
  };
}

async function runInternalTool(name: ToolName, input: Record<string, unknown>) {
  const tool = getMCPTool(name);
  if (!tool) return mcpText(`Tool not found: ${name}`, true);

  try {
    const result = await tool.execute(input);
    const maybeFormatted = (result as { formatted?: unknown })?.formatted;
    const text = typeof maybeFormatted === 'string' && maybeFormatted.length > 0
      ? maybeFormatted
      : JSON.stringify(result, null, 2);
    return mcpText(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return mcpText(`Tool execution failed: ${message}`, true);
  }
}

export async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: 'builderbrain-mcp',
    version: getAppVersion(),
  });

  server.registerTool(
    'brain_context_pack',
    {
      title: 'Build Context Pack',
      description: 'Build a full context pack for a task with domains, books, risk, and confidence.',
      inputSchema: z.object({
        task: z.string().min(1),
      }),
    },
    async ({ task }) => runInternalTool('brain_context_pack', { task })
  );

  server.registerTool(
    'brain_propose',
    {
      title: 'Generate Proposal',
      description: 'Generate a proposal with risk, confidence, testing, and rollback guidance.',
      inputSchema: z.object({
        task: z.string().min(1),
      }),
    },
    async ({ task }) => runInternalTool('brain_propose', { task })
  );

  server.registerTool(
    'brain_save_lesson',
    {
      title: 'Save Lesson',
      description: 'Save a lesson to self-learning memory with task/problem/rootCause/solution/evidence.',
      inputSchema: z.object({
        task: z.string().min(1),
        problem: z.string().min(1),
        rootCause: z.string().min(1),
        solution: z.string().min(1),
        evidence: z.string().min(1),
      }),
    },
    async ({ task, problem, rootCause, solution, evidence }) =>
      runInternalTool('brain_save_lesson', { task, problem, rootCause, solution, evidence })
  );

  server.registerTool(
    'brain_status',
    {
      title: 'BuilderBrain Status',
      description: 'Get BuilderBrain status including version, books, runs, and lesson availability.',
    },
    async () => runInternalTool('brain_status', {})
  );

  server.registerTool(
    'brain_repo_add',
    {
      title: 'Add Repo',
      description: 'Add a public GitHub repo into quarantine safely.',
      inputSchema: z.object({
        url: z.string().url(),
        topic: z.string().optional(),
      }),
    },
    async ({ url, topic }) => runInternalTool('brain_repo_add', { url, topic })
  );

  server.registerTool(
    'brain_repo_list',
    {
      title: 'List Repos',
      description: 'List all tracked repos and statuses.',
    },
    async () => runInternalTool('brain_repo_list', {})
  );

  server.registerTool(
    'brain_repo_analyze',
    {
      title: 'Analyze Repo',
      description: 'Run safe analysis: metadata, license, risk, score, summary.',
      inputSchema: z.object({ repoId: z.string().min(1) }),
    },
    async ({ repoId }) => runInternalTool('brain_repo_analyze', { repoId })
  );

  server.registerTool(
    'brain_repo_score',
    {
      title: 'Score Repo',
      description: 'Get scorecard for a tracked repo.',
      inputSchema: z.object({ repoId: z.string().min(1) }),
    },
    async ({ repoId }) => runInternalTool('brain_repo_score', { repoId })
  );

  server.registerTool(
    'brain_repo_digest',
    {
      title: 'Digest Repo',
      description: 'Generate safe digest for a tracked repo.',
      inputSchema: z.object({ repoId: z.string().min(1) }),
    },
    async ({ repoId }) => runInternalTool('brain_repo_digest', { repoId })
  );

  server.registerTool(
    'brain_repo_accept',
    {
      title: 'Accept Repo',
      description: 'Accept analyzed repo into trusted accepted folder.',
      inputSchema: z.object({ repoId: z.string().min(1) }),
    },
    async ({ repoId }) => runInternalTool('brain_repo_accept', { repoId })
  );

  server.registerTool(
    'brain_chat',
    {
      title: 'BuilderBrain Chat',
      description: 'Send one chat prompt to BuilderBrain and get answer.',
      inputSchema: z.object({ message: z.string().min(1) }),
    },
    async ({ message }) => runInternalTool('brain_chat', { message })
  );

  server.registerTool(
    'brain_chat_ensemble',
    {
      title: 'BuilderBrain 3-AI Debate Chat',
      description: 'Run 3-agent ensemble and return merged answer and members.',
      inputSchema: z.object({ message: z.string().min(1), count: z.number().int().min(2).max(3).optional() }),
    },
    async ({ message, count }) => runInternalTool('brain_chat_ensemble', { message, count })
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function configureWorkingDirectory(): void {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const defaultRoot = resolve(moduleDir, '..', '..');
  const targetRoot = (process.env.BUILDERBRAIN_ROOT?.trim() || defaultRoot);
  process.chdir(targetRoot);
}

const isMain = process.argv[1] &&
  (process.argv[1] === fileURLToPath(import.meta.url) ||
   process.argv[1].endsWith('src/mcp/server.ts') ||
   process.argv[1].endsWith('dist/mcp/server.js'));
if (isMain) {
  configureWorkingDirectory();
  startMcpServer().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`builderbrain-mcp failed to start: ${message}\n`);
    process.exit(1);
  });
}
