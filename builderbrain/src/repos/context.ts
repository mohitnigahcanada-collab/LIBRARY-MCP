import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { guessTaskCategories } from './categories.js';
import { RepoScorecard } from './types.js';

export interface RepoContextChunk {
  categories: string[];
  miniBooks: Array<{ category: string; path: string; content: string }>;
  repoSummaries: Array<{ repoId: string; path: string; content: string; score: number }>;
  safetyWarnings: string[];
}

function readSafe(path: string, maxChars = 3500): string {
  try {
    return readFileSync(path, 'utf-8').slice(0, maxChars);
  } catch {
    return '';
  }
}

export function buildRepoContextForTask(task: string): RepoContextChunk {
  const categories = guessTaskCategories(task, 3).map((c) => c.id);
  const miniBooks: RepoContextChunk['miniBooks'] = [];
  for (const category of categories) {
    const path = join(process.cwd(), 'brain-data', 'library', 'mini-book', `${category}.md`);
    if (!existsSync(path)) continue;
    miniBooks.push({ category, path, content: readSafe(path) });
  }

  const metadataRoot = join(process.cwd(), 'brain-data', 'big-bible', 'repos', 'metadata');
  const summaryRoot = join(process.cwd(), 'brain-data', 'big-bible', 'repos', 'summaries');
  const scoreRoot = join(process.cwd(), 'brain-data', 'big-bible', 'repos', 'scorecards');
  const candidates: Array<{ repoId: string; score: number; path: string; content: string }> = [];

  if (existsSync(metadataRoot)) {
    for (const file of readdirSync(metadataRoot)) {
      if (!file.endsWith('.json')) continue;
      const metadata = JSON.parse(readFileSync(join(metadataRoot, file), 'utf-8')) as { id: string; topic: string; status: string };
      if (!categories.includes(metadata.topic)) continue;
      if (metadata.status === 'quarantined' || metadata.status === 'error') continue;
      const summaryPath = join(summaryRoot, `${metadata.id}.md`);
      if (!existsSync(summaryPath)) continue;
      const scorePath = join(scoreRoot, `${metadata.id}.score.json`);
      const score = existsSync(scorePath) ? (JSON.parse(readFileSync(scorePath, 'utf-8')) as RepoScorecard).qualityScore : 0;
      candidates.push({ repoId: metadata.id, score, path: summaryPath, content: readSafe(summaryPath, 2400) });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const repoSummaries = candidates.slice(0, 3);
  const safetyWarnings = [
    'Never execute unknown repo code from context pack references.',
    'Respect license and risk score before reusing implementation details.',
  ];

  return { categories, miniBooks, repoSummaries, safetyWarnings };
}
