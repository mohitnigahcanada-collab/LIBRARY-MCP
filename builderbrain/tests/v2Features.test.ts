import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { rmSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { getMCPTool } from '../src/mcp/index.js';

const tmpBase = join(tmpdir(), `bb-v2-test-${Date.now()}`);
const origCwd = process.cwd;

describe('BuilderBrain V2 Agentic Features', () => {
  beforeEach(() => {
    process.cwd = () => tmpBase;
    rmSync(tmpBase, { recursive: true, force: true });
    mkdirSync(join(tmpBase, 'brain-data', 'sandbox'), { recursive: true });
    mkdirSync(join(tmpBase, 'brain-data', 'library', 'user-style'), { recursive: true });
  });

  afterEach(() => {
    process.cwd = origCwd;
    rmSync(tmpBase, { recursive: true, force: true });
  });

  it('Feature 3: brain_save_rule saves and hot-reloads user style', async () => {
    const tool = getMCPTool('brain_save_rule');
    expect(tool).toBeDefined();

    const result = await tool!.execute({ rule: 'Never use Tailwind, use Vanilla CSS' });
    expect((result as any).success).toBe(true);

    const ruleFile = join(tmpBase, 'brain-data', 'library', 'user-style', 'do-not-ask-rules.md');
    expect(existsSync(ruleFile)).toBe(true);
    
    const content = readFileSync(ruleFile, 'utf-8');
    expect(content).toContain('Never use Tailwind, use Vanilla CSS');
  });

  it('Feature 4: brain_propose requires force: true for Critical risk tasks', async () => {
    const tool = getMCPTool('brain_propose');
    expect(tool).toBeDefined();

    // "delete database" triggers Critical risk in classifier
    const promise = tool!.execute({ task: 'delete the production database completely' });
    await expect(promise).rejects.toThrow(/High Risk Task detected/);
    
    // Now with force: true
    const forcePromise = tool!.execute({ task: 'delete the production database completely', force: true });
    await expect(forcePromise).resolves.toBeDefined();
  });

  it('Feature 5: brain_test_code executes sandboxed JS and returns stdout', async () => {
    const tool = getMCPTool('brain_test_code');
    expect(tool).toBeDefined();

    const code = `console.log("Hello from the sandbox");`;
    const result: any = await tool!.execute({ code, language: 'javascript' });
    
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Hello from the sandbox');
    expect(result.stderr).toBe('');
  });

  it('Feature 5: brain_test_code safely catches syntax errors', async () => {
    const tool = getMCPTool('brain_test_code');
    const code = `console.log("Missing paren";`;
    const result: any = await tool!.execute({ code, language: 'javascript' });
    
    expect(result.success).toBe(false);
    expect(result.stderr).toContain('SyntaxError');
  });
});
