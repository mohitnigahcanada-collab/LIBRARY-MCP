import { resolve, sep } from 'path';

const DEFAULT_ALLOWED_CATEGORIES = ['pocket-rules', 'mini-book', 'self-learning', 'user-style'];

export function resolveSafeLibraryMarkdownPath(
  libraryRoot: string,
  rawPath: string,
  allowedCategories = DEFAULT_ALLOWED_CATEGORIES
): string | null {
  if (!rawPath || rawPath.includes('\0')) return null;
  let decoded = rawPath.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return null;
  }

  const normalized = decoded.replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.includes('..')) return null;
  const parts = normalized.split('/');
  if (parts.length !== 2) return null;

  const [category, file] = parts;
  if (!allowedCategories.includes(category)) return null;
  if (!file.endsWith('.md')) return null;
  if (file.includes('/') || file.includes('\\')) return null;

  const rootResolved = resolve(libraryRoot);
  const resolved = resolve(rootResolved, category, file);
  if (!resolved.startsWith(rootResolved + sep)) return null;
  return resolved;
}
