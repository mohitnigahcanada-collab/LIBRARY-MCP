import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Patch cwd before importing module so library path resolves to temp dir
const tmpBase = join(tmpdir(), `bb-test-${Date.now()}`);
mkdirSync(join(tmpBase, 'brain-data', 'library', 'self-learning'), { recursive: true });

const origCwd = process.cwd;
process.cwd = () => tmpBase;

const { saveLesson, hasPriorLessons, readSolvedProblems } = await import('../src/memory/selfLearning.js');

describe('selfLearning', () => {
  const solvedPath = join(tmpBase, 'brain-data', 'library', 'self-learning', 'solved-problems.md');

  beforeEach(() => {
    if (existsSync(solvedPath)) rmSync(solvedPath);
  });

  afterEach(() => {
    process.cwd = origCwd;
  });

  it('hasPriorLessons returns false when file is empty', () => {
    expect(hasPriorLessons()).toBe(false);
  });

  it('saves a lesson and hasPriorLessons returns true', () => {
    saveLesson({
      task: 'Add oauth',
      problem: 'Redirect URI mismatch',
      rootCause: 'Wrong env var',
      solution: 'Set OAUTH_REDIRECT_URI correctly',
      evidence: 'Login flow works end to end',
    });
    expect(hasPriorLessons()).toBe(true);
  });

  it('saved lesson contains all fields', () => {
    saveLesson({
      task: 'Fix JWT expiry',
      problem: 'Tokens expire too quickly',
      rootCause: 'Default expiry is 1s in test env',
      solution: 'Set JWT_EXPIRY=1h in env',
      evidence: 'npm test passes',
    });
    const content = readSolvedProblems();
    expect(content).toContain('Fix JWT expiry');
    expect(content).toContain('Tokens expire too quickly');
    expect(content).toContain('Set JWT_EXPIRY=1h in env');
  });

  it('saves multiple lessons without overwriting', () => {
    saveLesson({ task: 'Lesson A', problem: 'p1', rootCause: 'r1', solution: 's1', evidence: 'e1' });
    saveLesson({ task: 'Lesson B', problem: 'p2', rootCause: 'r2', solution: 's2', evidence: 'e2' });
    const content = readSolvedProblems();
    expect(content).toContain('Lesson A');
    expect(content).toContain('Lesson B');
  });
});
