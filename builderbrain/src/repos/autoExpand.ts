import { loadConfig } from '../config/manager.js';
import { expandLibraryByCategory } from './service.js';
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { ensureCategoriesFile } from './categories.js';
import { getLibraryPath } from '../storage/paths.js';
import { compressCategoryMiniBook } from './service.js';

let timer: ReturnType<typeof setInterval> | null = null;
let lastRunAt: string | null = null;
let lastSummary = '';
let categoryCursor = 0;

function miniBookCount(): number {
  const dir = join(getLibraryPath(), 'mini-book');
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((f) => f.endsWith('.md')).length;
}

async function runCycle(): Promise<void> {
  const cfg = loadConfig();
  const auto = cfg.auto_expand;
  if (!auto?.enabled) return;
  const all = ensureCategoriesFile().map((c) => c.id);
  const categories = auto.categories?.length ? auto.categories : all;
  const targetBooks = Math.max(20, auto.target_books_min ?? 100);
  const need = miniBookCount() < targetBooks;
  const budget = Math.max(1, auto.cycle_repo_budget ?? 6);

  const runList = need ? categories : [categories[categoryCursor % categories.length]];
  let used = 0;
  for (const category of runList) {
    if (used >= budget) break;
    try {
      const result = await expandLibraryByCategory({
        category,
        mostStarred: auto.most_starred,
        fresh: auto.fresh,
        safe: auto.safe,
        autoAnalyze: true,
        repoBudget: Math.max(1, Math.floor(budget / Math.max(1, runList.length))),
        useAiCuration: auto.use_ai_curation ?? true,
      });
      used += result.added.length;
      compressCategoryMiniBook(category);
      categoryCursor = (categoryCursor + 1) % Math.max(1, categories.length);
      lastSummary = `[${category}] added=${result.added.length}`;
    } catch {
      // keep loop alive
    }
  }
  lastRunAt = new Date().toISOString();
}

export function startAutoExpandWorker(): void {
  if (timer) return;
  const cfg = loadConfig();
  const auto = cfg.auto_expand;
  if (!auto?.enabled) return;
  const minutes = Math.max(15, auto.interval_minutes || 180);
  runCycle().catch(() => {});
  timer = setInterval(() => {
    runCycle().catch(() => {});
  }, minutes * 60 * 1000);
  timer.unref?.();
}

export function getAutoExpandStatus() {
  const cfg = loadConfig();
  return {
    enabled: Boolean(cfg.auto_expand?.enabled),
    intervalMinutes: cfg.auto_expand?.interval_minutes ?? 180,
    targetBooksMin: cfg.auto_expand?.target_books_min ?? 100,
    currentMiniBooks: miniBookCount(),
    lastRunAt,
    lastSummary,
  };
}

export async function runAutoExpandNow() {
  await runCycle();
  return getAutoExpandStatus();
}
