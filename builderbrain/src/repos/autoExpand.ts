import { loadConfig } from '../config/manager.js';
import { expandLibraryByCategory } from './service.js';

let timer: ReturnType<typeof setInterval> | null = null;

async function runCycle(): Promise<void> {
  const cfg = loadConfig();
  const auto = cfg.auto_expand;
  if (!auto?.enabled) return;
  const categories = auto.categories?.length ? auto.categories : ['ai-agent-frameworks'];
  for (const category of categories) {
    try {
      await expandLibraryByCategory({
        category,
        mostStarred: auto.most_starred,
        fresh: auto.fresh,
        safe: auto.safe,
        autoAnalyze: true,
      });
    } catch {
      // keep loop alive
    }
  }
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
