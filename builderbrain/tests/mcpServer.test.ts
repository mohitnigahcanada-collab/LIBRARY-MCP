import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('real mcp stdio server', () => {
  const projectRoot = process.cwd();
  const tempRoot = join(tmpdir(), `builderbrain-mcp-${Date.now()}`);

  beforeAll(() => {
    mkdirSync(join(tempRoot, 'brain-data', 'library', 'pocket-rules'), { recursive: true });
    mkdirSync(join(tempRoot, 'brain-data', 'library', 'mini-book'), { recursive: true });
    mkdirSync(join(tempRoot, 'brain-data', 'library', 'self-learning'), { recursive: true });
    mkdirSync(join(tempRoot, 'brain-data', 'library', 'user-style'), { recursive: true });

    writeFileSync(join(tempRoot, 'brain-data', 'library', 'pocket-rules', 'before-coding.md'), '## Rules\n- Be safe', 'utf-8');
    writeFileSync(join(tempRoot, 'brain-data', 'library', 'mini-book', 'security.md'), '## Antipattern\nNo path traversal.', 'utf-8');
    writeFileSync(join(tempRoot, 'brain-data', 'library', 'self-learning', 'solved-problems.md'), '_No entries yet. Lessons will be added here via `brain learn`._', 'utf-8');
    writeFileSync(join(tempRoot, 'brain-data', 'library', 'user-style', 'communication-style.md'), 'Direct.', 'utf-8');
    writeFileSync(join(tempRoot, 'package.json'), JSON.stringify({ name: 'builderbrain-test', version: '7.7.7' }), 'utf-8');
  });

  afterAll(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('serves tools/list and tools/call over stdio', async () => {
    const tsxBin = join(projectRoot, 'node_modules', '.bin', 'tsx');
    const serverEntry = join(projectRoot, 'src', 'mcp', 'server.ts');

    const transport = new StdioClientTransport({
      command: tsxBin,
      args: [serverEntry],
      cwd: tempRoot,
      stderr: 'pipe',
      env: {
        ...process.env,
        BUILDERBRAIN_ROOT: tempRoot,
      } as Record<string, string>,
    });

    const client = new Client({ name: 'builderbrain-mcp-test-client', version: '1.0.0' });
    await client.connect(transport);

    const tools = await client.listTools();
    const toolNames = tools.tools.map((t) => t.name);
    expect(toolNames).toContain('brain_context_pack');
    expect(toolNames).toContain('brain_propose');
    expect(toolNames).toContain('brain_save_lesson');
    expect(toolNames).toContain('brain_status');

    const status = await client.callTool({
      name: 'brain_status',
      arguments: {},
    });
    const statusText = status.content.find((item) => item.type === 'text');
    expect(statusText?.type).toBe('text');
    if (statusText?.type === 'text') {
      expect(statusText.text).toContain('7.7.7');
    }

    const context = await client.callTool({
      name: 'brain_context_pack',
      arguments: { task: 'harden auth middleware' },
    });
    const contextText = context.content.find((item) => item.type === 'text');
    expect(contextText?.type).toBe('text');
    if (contextText?.type === 'text') {
      expect(contextText.text.length).toBeGreaterThan(10);
    }

    await client.close();
    await transport.close();
  });
});
