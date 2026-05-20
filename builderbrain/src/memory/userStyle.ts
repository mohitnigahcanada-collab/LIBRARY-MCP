import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getLibraryPath } from './selfLearning.js';

const BLOCKED_TERMS = ['password', 'credential', 'api key', 'token', 'secret', 'ssn', 'credit card', 'phone number', 'address'];

export function checkSafeMemory(content: string): { safe: boolean; reason?: string } {
  const lower = content.toLowerCase();
  const blocked = BLOCKED_TERMS.find((term) => lower.includes(term));
  if (blocked) {
    return { safe: false, reason: `Contains prohibited term: "${blocked}". Per safe-memory-only.md, sensitive data cannot be stored.` };
  }
  return { safe: true };
}

export function readUserStyle(file: 'communication-style' | 'decision-style' | 'do-not-ask-rules'): string {
  const path = join(getLibraryPath(), 'user-style', `${file}.md`);
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf-8');
}

export function appendToUserStyle(
  file: 'communication-style' | 'decision-style' | 'do-not-ask-rules',
  preference: string
): { success: boolean; reason?: string } {
  const check = checkSafeMemory(preference);
  if (!check.safe) return { success: false, reason: check.reason };

  const path = join(getLibraryPath(), 'user-style', `${file}.md`);
  const existing = existsSync(path) ? readFileSync(path, 'utf-8') : '';
  const date = new Date().toISOString().split('T')[0];
  writeFileSync(path, existing + `\n\n## Added [${date}]\n${preference}`, 'utf-8');
  return { success: true };
}
