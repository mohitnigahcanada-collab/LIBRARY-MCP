import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface Lesson {
  task: string;
  problem: string;
  rootCause: string;
  solution: string;
  evidence: string;
}

export function getLibraryPath(): string {
  return join(process.cwd(), 'brain-data', 'library');
}

function getSolvedProblemsPath(): string {
  return join(getLibraryPath(), 'self-learning', 'solved-problems.md');
}

export function saveLesson(lesson: Lesson): void {
  const path = getSolvedProblemsPath();
  const dir = join(getLibraryPath(), 'self-learning');
  mkdirSync(dir, { recursive: true });

  const existing = existsSync(path) ? readFileSync(path, 'utf-8') : '';
  const date = new Date().toISOString().split('T')[0];

  const entry = `
## [${date}] ${lesson.task.slice(0, 60)}
**Task**: ${lesson.task}
**Problem**: ${lesson.problem}
**Root Cause**: ${lesson.rootCause}
**Solution**: ${lesson.solution}
**Evidence**: ${lesson.evidence}
`;

  const updated = existing.includes('_No entries yet')
    ? existing.replace('_No entries yet. Lessons will be added here via `brain learn`._', entry.trim())
    : existing + '\n' + entry.trim();

  writeFileSync(path, updated, 'utf-8');
}

export function readSolvedProblems(): string {
  const path = getSolvedProblemsPath();
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf-8');
}

export function hasPriorLessons(): boolean {
  const content = readSolvedProblems();
  return content.includes('## [');
}
