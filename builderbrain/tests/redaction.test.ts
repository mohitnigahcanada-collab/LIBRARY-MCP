import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('secret redaction', () => {
  const originalCwd = process.cwd;
  const tempRoot = join(tmpdir(), `builderbrain-redaction-${Date.now()}`);

  let saveRunLog: (typeof import('../src/logger.js'))['saveRunLog'];
  let getRunLog: (typeof import('../src/logger.js'))['getRunLog'];
  let saveLesson: (typeof import('../src/memory/selfLearning.js'))['saveLesson'];
  let readSolvedProblems: (typeof import('../src/memory/selfLearning.js'))['readSolvedProblems'];

  beforeAll(async () => {
    mkdirSync(join(tempRoot, 'brain-data', 'library', 'self-learning'), { recursive: true });
    mkdirSync(join(tempRoot, 'brain-data', 'runs'), { recursive: true });
    writeFileSync(join(tempRoot, 'package.json'), JSON.stringify({ name: 'builderbrain-test', version: '1.0.0' }), 'utf-8');

    process.cwd = () => tempRoot;
    ({ saveRunLog, getRunLog } = await import('../src/logger.js'));
    ({ saveLesson, readSolvedProblems } = await import('../src/memory/selfLearning.js'));
  });

  afterAll(() => {
    process.cwd = originalCwd;
    if (existsSync(tempRoot)) rmSync(tempRoot, { recursive: true, force: true });
  });

  it('redacts secrets in run logs', () => {
    const entry = saveRunLog({
      command: 'context',
      input: 'token sk-proj-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456 and Bearer xyz',
      detectedDomains: [],
      booksUsed: [],
      risk: 'Low',
      confidence: 'High',
      summary: 'debugging with https://hooks.slack.com/services/T/A/B',
    });

    const persisted = getRunLog(entry.id);
    expect(persisted?.input).toContain('[REDACTED]');
    expect(persisted?.input).not.toContain('sk-proj-');
    expect(persisted?.summary).not.toContain('hooks.slack.com/services');
  });

  it('redacts secrets in self-learning memory', () => {
    saveLesson({
      task: 'Fix auth key leak',
      problem: 'Printed sk-proj-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456 in logs',
      rootCause: 'debug statement',
      solution: 'remove it',
      evidence: 'Bearer abcdef no longer appears',
    });

    const content = readSolvedProblems();
    expect(content).toContain('[REDACTED]');
    expect(content).not.toContain('sk-proj-');
    expect(content).not.toContain('Bearer abcdef');
  });
});
