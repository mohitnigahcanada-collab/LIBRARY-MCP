import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getMCPTool } from '../src/mcp/index.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { rmSync, mkdirSync } from 'fs';

const tmpBase = join(tmpdir(), `bb-v3-test-${Date.now()}`);
const origCwd = process.cwd;

describe('BuilderBrain V3 Autonomous Features', () => {
  beforeEach(() => {
    process.cwd = () => tmpBase;
    rmSync(tmpBase, { recursive: true, force: true });
    mkdirSync(join(tmpBase, 'brain-data', 'runs'), { recursive: true });
    mkdirSync(join(tmpBase, 'brain-data', 'proposals'), { recursive: true });
  });

  afterEach(() => {
    process.cwd = origCwd;
    rmSync(tmpBase, { recursive: true, force: true });
  });

  it('Feature 1: brain_delegate spawns sub-agent roles', async () => {
    const tool = getMCPTool('brain_delegate');
    expect(tool).toBeDefined();

    const result: any = await tool!.execute({ 
      task: 'Build a nextjs app', 
      roles: ['UI Engineer', 'Backend Dev'] 
    });

    expect(result.success).toBe(true);
    expect(result.orchestrationPlan.subAgents.length).toBe(2);
    expect(result.orchestrationPlan.subAgents[0].agentRole).toBe('UI Engineer');
  });

  it('Feature 2: time travel gracefully handles non-git folders', async () => {
    const tool = getMCPTool('brain_snapshot');
    expect(tool).toBeDefined();

    // In this tmp folder, there is no git repo, so it should fail gracefully
    const result: any = await tool!.execute({ message: 'about to test' });
    expect(result.success).toBe(false);
  });
});
