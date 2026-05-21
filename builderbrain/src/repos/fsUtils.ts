import { readdirSync, statSync, readFileSync } from 'fs';
import { join, relative } from 'path';

export interface WalkItem {
  absolutePath: string;
  relativePath: string;
  size: number;
}

export function listTopLevel(repoPath: string): string[] {
  return readdirSync(repoPath).sort();
}

export function walkRepoFiles(repoPath: string, maxFiles = 10000): WalkItem[] {
  const out: WalkItem[] = [];
  const stack = [''];
  while (stack.length > 0 && out.length < maxFiles) {
    const current = stack.pop() as string;
    const abs = join(repoPath, current);
    let entries: Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }>;
    try {
      entries = readdirSync(abs, { withFileTypes: true }) as unknown as Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }>;
    } catch {
      continue;
    }
    for (const entry of entries) {
      const rel = current ? join(current, entry.name) : entry.name;
      const full = join(repoPath, rel);
      if (entry.isDirectory()) {
        stack.push(rel);
      } else if (entry.isFile()) {
        let stat;
        try {
          stat = statSync(full);
        } catch {
          continue;
        }
        out.push({
          absolutePath: full,
          relativePath: relative(repoPath, full).replace(/\\/g, '/'),
          size: stat.size,
        });
        if (out.length >= maxFiles) break;
      }
    }
  }
  return out;
}

export function safeReadText(path: string, maxBytes = 256_000): string {
  try {
    const data = readFileSync(path);
    const slice = data.subarray(0, Math.min(data.length, maxBytes));
    return slice.toString('utf-8');
  } catch {
    return '';
  }
}

export function looksBinary(content: Buffer): boolean {
  const sample = content.subarray(0, Math.min(content.length, 4096));
  for (const b of sample) {
    if (b === 0) return true;
  }
  return false;
}
