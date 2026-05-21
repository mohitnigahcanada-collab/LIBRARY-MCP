export interface ParsedGithubRepo {
  owner: string;
  repo: string;
  repoId: string;
  canonicalUrl: string;
  cloneUrl: string;
}

const SAFE_PART = /^[A-Za-z0-9._-]+$/;

export function buildRepoId(owner: string, repo: string): string {
  return `${owner}__${repo}`;
}

export function parseGithubRepoUrl(rawUrl: string): ParsedGithubRepo | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') return null;
  if (parsed.hostname !== 'github.com' && parsed.hostname !== 'www.github.com') return null;
  if (parsed.search || parsed.hash) return null;

  const cleanPath = decodeURIComponent(parsed.pathname).replace(/^\/+|\/+$/g, '');
  const parts = cleanPath.split('/');
  if (parts.length !== 2) return null;

  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, '');
  if (!owner || !repo) return null;
  if (!SAFE_PART.test(owner) || !SAFE_PART.test(repo)) return null;
  if (owner.includes('..') || repo.includes('..')) return null;

  const repoId = buildRepoId(owner, repo);
  return {
    owner,
    repo,
    repoId,
    canonicalUrl: `https://github.com/${owner}/${repo}`,
    cloneUrl: `https://github.com/${owner}/${repo}.git`,
  };
}
