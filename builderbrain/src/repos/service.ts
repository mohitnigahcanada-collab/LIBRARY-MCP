import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { spawnSync } from 'child_process';
import { tmpdir } from 'os';
import { mkdtempSync } from 'fs';
import { RepoAddResult, RepoMetadata, RepoScorecard } from './types.js';
import {
  ensureRepoStructure,
  getRepoLocalPath,
  getMetadataPath,
  getLicensePath,
  getScorePath,
  getRiskPath,
  getSummaryPath,
  getDigestPath,
  getDigestSkippedPath,
  getRepoMetadataRoot,
  getRepoLogsPath,
  getResearchCategoryRoot,
} from './paths.js';
import { parseGithubRepoUrl } from './url.js';
import { collectRepoMetadata } from './metadata.js';
import { scanLicense } from './license.js';
import { scanRepoRisk } from './risk.js';
import { scoreRepo } from './score.js';
import { buildRepoSummaryMarkdown } from './summary.js';
import { generateSafeDigest } from './digest.js';
import { ensureCategoriesFile, findCategory } from './categories.js';
import { routeChatEnsemble } from '../engines/aiRouter.js';

function nowIso(): string {
  return new Date().toISOString();
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2), 'utf-8');
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function logRepoAction(action: string, details: Record<string, unknown>): void {
  ensureRepoStructure();
  const line = JSON.stringify({ at: nowIso(), action, ...details });
  appendFileSync(getRepoLogsPath(), `${line}\n`, 'utf-8');
}

function moveDirSafe(source: string, dest: string): void {
  try {
    renameSync(source, dest);
    return;
  } catch (error) {
    const exdev = typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'EXDEV';
    if (!exdev) throw error;
  }
  cpSync(source, dest, { recursive: true, force: true });
  rmSync(source, { recursive: true, force: true });
}

function updateMetadataStatus(repoId: string, status: RepoMetadata['status']): RepoMetadata | null {
  const metadata = readJson<RepoMetadata>(getMetadataPath(repoId));
  if (!metadata) return null;
  metadata.status = status;
  metadata.updatedAt = nowIso();
  writeJson(getMetadataPath(repoId), metadata);
  return metadata;
}

export function getRepoMetadata(repoId: string): RepoMetadata | null {
  return readJson<RepoMetadata>(getMetadataPath(repoId));
}

export function listRepos(): RepoMetadata[] {
  ensureRepoStructure();
  const dir = getRepoMetadataRoot();
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const repos: RepoMetadata[] = [];
  for (const file of files) {
    const parsed = readJson<RepoMetadata>(join(dir, file));
    if (parsed) repos.push(parsed);
  }
  return repos.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function addRepo(url: string, topic = 'general'): RepoAddResult {
  ensureRepoStructure();
  const parsed = parseGithubRepoUrl(url);
  if (!parsed) {
    return { success: false, repoId: 'unknown', repoName: 'unknown', message: 'Invalid GitHub HTTPS repo URL' };
  }

  const repoId = parsed.repoId;
  const targetPath = getRepoLocalPath(repoId, 'quarantined');
  const metadataPath = getMetadataPath(repoId);
  if (existsSync(targetPath) && existsSync(metadataPath)) {
    const meta = getRepoMetadata(repoId);
    return {
      success: true,
      repoId,
      repoName: `${parsed.owner}/${parsed.repo}`,
      message: `Already in quarantine: ${repoId}`,
      metadataPath: getMetadataPath(repoId),
    };
  }

  const tempRoot = mkdtempSync(join(tmpdir(), 'builderbrain-repo-'));
  const tempTarget = join(tempRoot, repoId);
  const clone = spawnSync('git', ['clone', '--depth=1', parsed.cloneUrl, tempTarget], {
    shell: false,
    encoding: 'utf-8',
    timeout: 120_000,
    maxBuffer: 5 * 1024 * 1024,
  });

  if (clone.status !== 0) {
    rmSync(tempRoot, { recursive: true, force: true });
    logRepoAction('repo_add_failed', { repoId, url: parsed.canonicalUrl, stderr: clone.stderr?.slice(0, 500) });
    return {
      success: false,
      repoId,
      repoName: `${parsed.owner}/${parsed.repo}`,
      message: `Clone failed: ${(clone.stderr || clone.stdout || 'unknown error').toString().slice(0, 300)}`,
    };
  }

  mkdirSync(join(targetPath, '..'), { recursive: true });
  moveDirSafe(tempTarget, targetPath);
  rmSync(tempRoot, { recursive: true, force: true });

  const metadata = collectRepoMetadata({
    id: repoId,
    owner: parsed.owner,
    name: parsed.repo,
    url: parsed.canonicalUrl,
    topic,
    status: 'quarantined',
    localPath: targetPath,
  });
  writeJson(getMetadataPath(repoId), metadata);
  logRepoAction('repo_add', { repoId, topic, url: parsed.canonicalUrl, status: 'quarantined' });

  return {
    success: true,
    repoId,
    repoName: `${parsed.owner}/${parsed.repo}`,
    message: `Cloned to quarantine: ${repoId}`,
    metadataPath: getMetadataPath(repoId),
  };
}

export function analyzeRepo(repoId: string): { success: boolean; message: string; score?: RepoScorecard } {
  ensureRepoStructure();
  const metadata = getRepoMetadata(repoId);
  if (!metadata) return { success: false, message: `Repo not found: ${repoId}` };
  if (!existsSync(metadata.localPath)) return { success: false, message: `Local path missing: ${metadata.localPath}` };

  const refreshed = collectRepoMetadata({
    id: metadata.id,
    owner: metadata.owner,
    name: metadata.name,
    url: metadata.url,
    topic: metadata.topic,
    status: metadata.status,
    localPath: metadata.localPath,
    createdAt: metadata.createdAt,
  });
  const license = scanLicense(repoId, metadata.localPath);
  const risk = scanRepoRisk(repoId, metadata.localPath);
  refreshed.license = license.license;
  const score = scoreRepo(refreshed, risk, license);
  const summary = buildRepoSummaryMarkdown({ metadata: refreshed, risk, license, score });

  refreshed.status = 'analyzed';
  refreshed.updatedAt = nowIso();

  writeJson(getMetadataPath(repoId), refreshed);
  writeJson(getLicensePath(repoId), license);
  writeJson(getRiskPath(repoId), risk);
  writeJson(getScorePath(repoId), score);
  writeFileSync(getSummaryPath(repoId), summary, 'utf-8');

  logRepoAction('repo_analyze', { repoId, risk: risk.riskLevel, score: score.qualityScore });
  return { success: true, message: `Analyzed ${repoId}`, score };
}

export function scoreRepoCard(repoId: string): RepoScorecard | null {
  const fromFile = readJson<RepoScorecard>(getScorePath(repoId));
  if (fromFile) return fromFile;
  const analyzed = analyzeRepo(repoId);
  if (!analyzed.success) return null;
  return analyzed.score ?? null;
}

export function digestRepo(repoId: string): { success: boolean; message: string; digestPath?: string; skippedPath?: string } {
  const metadata = getRepoMetadata(repoId);
  if (!metadata) return { success: false, message: `Repo not found: ${repoId}` };
  const result = generateSafeDigest(repoId, metadata.localPath);
  logRepoAction('repo_digest', { repoId, includedFiles: result.includedFiles, skippedFiles: result.skippedFiles });
  return { success: true, message: `Digest created for ${repoId}`, digestPath: result.digestPath, skippedPath: result.skippedPath };
}

export function acceptRepo(repoId: string): { success: boolean; message: string; path?: string } {
  const metadata = getRepoMetadata(repoId);
  if (!metadata) return { success: false, message: `Repo not found: ${repoId}` };
  if (metadata.status !== 'analyzed' && metadata.status !== 'accepted') {
    return { success: false, message: `Repo must be analyzed before accept: ${repoId}` };
  }
  const acceptedPath = getRepoLocalPath(repoId, 'accepted');
  if (!existsSync(acceptedPath)) {
    mkdirSync(join(acceptedPath, '..'), { recursive: true });
    moveDirSafe(metadata.localPath, acceptedPath);
  }
  metadata.localPath = acceptedPath;
  metadata.status = 'accepted';
  metadata.updatedAt = nowIso();
  writeJson(getMetadataPath(repoId), metadata);
  logRepoAction('repo_accept', { repoId, path: acceptedPath });
  return { success: true, message: `Accepted ${repoId}`, path: acceptedPath };
}

export function repoDetails(repoId: string): Record<string, unknown> | null {
  const metadata = getRepoMetadata(repoId);
  if (!metadata) return null;
  return {
    metadata,
    risk: readJson(getRiskPath(repoId)),
    score: readJson(getScorePath(repoId)),
    license: readJson(getLicensePath(repoId)),
    summaryPath: existsSync(getSummaryPath(repoId)) ? getSummaryPath(repoId) : null,
    digestPath: existsSync(getDigestPath(repoId)) ? getDigestPath(repoId) : null,
    digestSkippedPath: existsSync(getDigestSkippedPath(repoId)) ? getDigestSkippedPath(repoId) : null,
  };
}

interface GitHubSearchRepo {
  full_name: string;
  html_url: string;
  stargazers_count: number;
  pushed_at: string;
  created_at: string;
}

async function searchGitHubRepos(query: string, perPage: number): Promise<GitHubSearchRepo[]> {
  const token = process.env.GITHUB_TOKEN?.trim();
  const response = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${perPage}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    return [];
  }
  const data = (await response.json()) as { items?: GitHubSearchRepo[] };
  return data.items ?? [];
}

export async function expandLibraryByCategory(opts: {
  category: string;
  mostStarred: number;
  fresh: number;
  safe?: boolean;
  autoAnalyze?: boolean;
  repoBudget?: number;
  useAiCuration?: boolean;
}): Promise<{ success: boolean; message: string; added: string[]; reportPath: string }> {
  ensureRepoStructure();
  ensureCategoriesFile();
  const category = findCategory(opts.category);
  if (!category) {
    return { success: false, message: `Unknown category: ${opts.category}`, added: [], reportPath: '' };
  }

  const root = getResearchCategoryRoot(category.id);
  mkdirSync(root, { recursive: true });

  const starredQuery = `(${category.searchTerms[0] ?? category.id}) stars:>1000 archived:false`;
  const mostStarred = await searchGitHubRepos(starredQuery, Math.max(1, opts.mostStarred));

  const day30 = new Date(Date.now() - (30 * 24 * 3600 * 1000)).toISOString().slice(0, 10);
  const freshQuery = `(${category.searchTerms[0] ?? category.id}) pushed:>=${day30} stars:>50 archived:false`;
  const fresh = await searchGitHubRepos(freshQuery, Math.max(1, opts.fresh));

  writeJson(join(root, 'candidates-most-starred.json'), mostStarred);
  writeJson(join(root, 'candidates-fresh-trending.json'), fresh);

  const merged = [...mostStarred, ...fresh];
  const dedup = new Map<string, GitHubSearchRepo>();
  for (const repo of merged) {
    if (!dedup.has(repo.full_name)) dedup.set(repo.full_name, repo);
  }
  let selected = [...dedup.values()]
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, Math.max(opts.mostStarred, opts.fresh));

  if (opts.useAiCuration && selected.length > 1) {
    const curated = await aiCurateCandidates(category.id, selected);
    if (curated.length > 0) selected = curated;
  }

  writeJson(join(root, 'selected-repos.json'), selected);

  const added: string[] = [];
  const repoLimit = Math.max(1, opts.repoBudget ?? (opts.safe ? 5 : 10));
  for (const repo of selected.slice(0, repoLimit)) {
    const add = addRepo(repo.html_url, category.id);
    if (add.success) {
      added.push(add.repoId);
      if (opts.autoAnalyze !== false) {
        analyzeRepo(add.repoId);
      }
    }
  }

  const reportPath = join(root, 'category-report.md');
  const report = `# Category Report: ${category.name}

Most-starred candidates: ${mostStarred.length}
Fresh/trending candidates: ${fresh.length}
Selected unique repos: ${selected.length}
Safely added in this run: ${added.length}

## Notes
- Source: GitHub Search API
- Safe mode: ${opts.safe ? 'enabled' : 'disabled'}
- Repo code execution: disabled
`;
  writeFileSync(reportPath, report, 'utf-8');
  logRepoAction('library_expand', { category: category.id, addedCount: added.length, selectedCount: selected.length });

  return {
    success: true,
    message: `Expanded category ${category.id}. Added ${added.length} repos.`,
    added,
    reportPath,
  };
}

async function aiCurateCandidates(categoryId: string, candidates: GitHubSearchRepo[]): Promise<GitHubSearchRepo[]> {
  const short = candidates.slice(0, 20);
  const prompt = `Category: ${categoryId}
Select best repos for practical engineering learning. Prefer active docs/testing/security signals from description and naming.
Return strict JSON with shape: {"order":["owner/repo", ...]}.
Candidates:
${short.map((r) => `- ${r.full_name} | stars=${r.stargazers_count} | pushed=${r.pushed_at}`).join('\n')}
`;
  try {
    const result = await routeChatEnsemble([{ role: 'user', content: prompt }], { count: 3 });
    const text = result.final.text;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return candidates;
    const parsed = JSON.parse(match[0]) as { order?: string[] };
    const order = parsed.order ?? [];
    if (!Array.isArray(order) || order.length === 0) return candidates;
    const byName = new Map(candidates.map((c) => [c.full_name.toLowerCase(), c]));
    const ranked: GitHubSearchRepo[] = [];
    for (const name of order) {
      const found = byName.get(String(name).toLowerCase());
      if (found && !ranked.includes(found)) ranked.push(found);
    }
    for (const c of candidates) {
      if (!ranked.includes(c)) ranked.push(c);
    }
    return ranked;
  } catch {
    return candidates;
  }
}

export function compressCategoryMiniBook(categoryId: string): { success: boolean; outputPath: string; message: string } {
  const summariesRoot = join(process.cwd(), 'brain-data', 'big-bible', 'repos', 'summaries');
  const metadataRoot = getRepoMetadataRoot();
  const scoreRoot = join(process.cwd(), 'brain-data', 'big-bible', 'repos', 'scorecards');
  const outPath = join(process.cwd(), 'brain-data', 'library', 'mini-book', `${categoryId}.md`);

  mkdirSync(join(outPath, '..'), { recursive: true });

  const metadataFiles = existsSync(metadataRoot) ? readdirSync(metadataRoot).filter((f) => f.endsWith('.json')) : [];
  const categoryRepos: Array<{ repoId: string; score: number; verdict: string }> = [];
  for (const file of metadataFiles) {
    const meta = readJson<RepoMetadata>(join(metadataRoot, file));
    if (!meta || meta.topic !== categoryId) continue;
    const score = readJson<RepoScorecard>(join(scoreRoot, `${meta.id}.score.json`));
    categoryRepos.push({ repoId: meta.id, score: score?.qualityScore ?? 0, verdict: score?.finalVerdict ?? 'Unknown' });
  }
  categoryRepos.sort((a, b) => b.score - a.score);

  const topRows = categoryRepos.slice(0, 10).map((r) => {
    const summaryPath = join(summariesRoot, `${r.repoId}.md`);
    const why = existsSync(summaryPath) ? (safeReadSummary(summaryPath) || r.verdict) : r.verdict;
    return `| ${r.repoId} | ${why.replace(/\|/g, '/')} |`;
  });

  const content = `# Mini Book: ${categoryId}

## When To Use This Book
Use this when working on tasks in ${categoryId}.

## Best Patterns
- Prefer repositories with strong README, tests, and low risk.
- Reuse architecture ideas before implementation details.

## Anti-Patterns
- Copying code blindly from unknown license repos.
- Running unknown install/build scripts from external repos.

## Recommended Architecture
- Start from accepted/analyzed repos with low risk score.
- Keep digest and summary files as primary context, not raw repo dump.

## Testing Checklist
- [ ] Verify risk report exists
- [ ] Verify scorecard exists
- [ ] Verify summary exists
- [ ] Run local app tests before adopting pattern

## Security Checklist
- [ ] No code execution from unknown repos
- [ ] License warning reviewed
- [ ] Secret files excluded from digest

## Best Repos To Reference
| Repo | Why |
| --- | --- |
${topRows.length > 0 ? topRows.join('\n') : '| none | No analyzed repos for this category yet. |'}

## Open Big Bible When
- You need deeper implementation details from a specific repo summary or digest.

## Do Not Do
- Do not treat a high score as automatic approval to copy code.
`;

  writeFileSync(outPath, content, 'utf-8');
  logRepoAction('library_compress', { category: categoryId, repos: categoryRepos.length, outputPath: outPath });
  return { success: true, outputPath: outPath, message: `Mini Book generated: ${outPath}` };
}

function safeReadSummary(path: string): string {
  try {
    const lines = readFileSync(path, 'utf-8').split('\n').filter((x) => x.trim());
    return lines.slice(0, 2).join(' ').slice(0, 120);
  } catch {
    return '';
  }
}

export function importReposFromMarkdown(input: {
  markdown?: string;
  filePath?: string;
  topic?: string;
  autoAnalyze?: boolean;
}): { success: boolean; message: string; imported: string[]; failed: Array<{ url: string; error: string }> } {
  let content = input.markdown ?? '';
  if (!content && input.filePath) {
    try {
      content = readFileSync(input.filePath, 'utf-8');
    } catch (error) {
      return {
        success: false,
        message: `Failed to read markdown file: ${input.filePath}`,
        imported: [],
        failed: [{ url: input.filePath, error: error instanceof Error ? error.message : String(error) }],
      };
    }
  }
  const urls = Array.from(new Set((content.match(/https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+(?:\.git)?/g) ?? [])));
  if (urls.length === 0) {
    return { success: false, message: 'No GitHub repo URLs found in markdown.', imported: [], failed: [] };
  }

  const imported: string[] = [];
  const failed: Array<{ url: string; error: string }> = [];
  for (const url of urls) {
    const added = addRepo(url, input.topic ?? 'general');
    if (!added.success) {
      failed.push({ url, error: added.message });
      continue;
    }
    imported.push(added.repoId);
    if (input.autoAnalyze !== false) {
      const analyzed = analyzeRepo(added.repoId);
      if (!analyzed.success) {
        failed.push({ url, error: analyzed.message });
      }
    }
  }

  logRepoAction('library_import_markdown', { importedCount: imported.length, failedCount: failed.length, topic: input.topic ?? 'general' });
  return {
    success: imported.length > 0,
    message: `Imported ${imported.length} repos from markdown (${failed.length} failed).`,
    imported,
    failed,
  };
}
