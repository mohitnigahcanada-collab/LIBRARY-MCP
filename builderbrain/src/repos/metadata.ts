import { existsSync } from 'fs';
import { join } from 'path';
import { RepoMetadata } from './types.js';
import { listTopLevel, walkRepoFiles, safeReadText } from './fsUtils.js';

const FRAMEWORK_RULES: Array<{ name: string; match: (files: string[], pkgText: string) => boolean }> = [
  { name: 'React', match: (files, pkg) => files.includes('src/App.tsx') || /"react"\s*:/.test(pkg) },
  { name: 'Vite', match: (files, pkg) => files.includes('vite.config.ts') || /"vite"\s*:/.test(pkg) },
  { name: 'Next.js', match: (files, pkg) => files.includes('next.config.js') || /"next"\s*:/.test(pkg) },
  { name: 'Express', match: (_, pkg) => /"express"\s*:/.test(pkg) },
  { name: 'Hono', match: (_, pkg) => /"hono"\s*:/.test(pkg) },
  { name: 'Fastify', match: (_, pkg) => /"fastify"\s*:/.test(pkg) },
  { name: 'NestJS', match: (_, pkg) => /"@nestjs\/core"\s*:/.test(pkg) },
  { name: 'Vue', match: (_, pkg) => /"vue"\s*:/.test(pkg) },
  { name: 'Svelte', match: (_, pkg) => /"svelte"\s*:/.test(pkg) },
  { name: 'Python', match: (files) => files.includes('requirements.txt') || files.includes('pyproject.toml') },
  { name: 'FastAPI', match: (_, pkg) => /fastapi/i.test(pkg) },
  { name: 'Django', match: (_, pkg) => /django/i.test(pkg) },
  { name: 'Rust', match: (files) => files.includes('Cargo.toml') },
  { name: 'Go', match: (files) => files.includes('go.mod') },
  { name: 'Docker', match: (files) => files.includes('Dockerfile') || files.includes('docker-compose.yml') },
  { name: 'GitHub Actions', match: (files) => files.some((f) => f.startsWith('.github/workflows/')) },
  { name: 'MCP', match: (_, pkg) => /modelcontextprotocol|mcp/i.test(pkg) },
  { name: 'LangChain', match: (_, pkg) => /langchain/i.test(pkg) },
  { name: 'LangGraph', match: (_, pkg) => /langgraph/i.test(pkg) },
  { name: 'LlamaIndex', match: (_, pkg) => /llamaindex/i.test(pkg) },
  { name: 'Playwright', match: (_, pkg) => /playwright/i.test(pkg) },
  { name: 'Vitest', match: (_, pkg) => /vitest/i.test(pkg) },
  { name: 'Jest', match: (_, pkg) => /jest/i.test(pkg) },
];

function detectPackageManager(files: string[]): string | null {
  if (files.includes('pnpm-lock.yaml')) return 'pnpm';
  if (files.includes('yarn.lock')) return 'yarn';
  if (files.includes('package-lock.json')) return 'npm';
  if (files.includes('requirements.txt')) return 'pip';
  if (files.includes('poetry.lock')) return 'poetry';
  if (files.includes('Cargo.lock')) return 'cargo';
  if (files.includes('go.sum')) return 'go';
  return null;
}

export function collectRepoMetadata(base: {
  id: string;
  owner: string;
  name: string;
  url: string;
  topic: string;
  status: RepoMetadata['status'];
  localPath: string;
  createdAt?: string;
}): RepoMetadata {
  const now = new Date().toISOString();
  const topLevel = existsSync(base.localPath) ? listTopLevel(base.localPath) : [];
  const fileItems = existsSync(base.localPath) ? walkRepoFiles(base.localPath, 10_000) : [];
  const fileList = fileItems.map((f) => f.relativePath);
  const pkgPath = join(base.localPath, 'package.json');
  const pkgText = existsSync(pkgPath) ? safeReadText(pkgPath, 256_000) : '';
  const readmePath = fileList.find((f) => /^readme/i.test(f));
  const licensePath = fileList.find((f) => /^license/i.test(f));

  const frameworks = FRAMEWORK_RULES
    .filter((r) => r.match(fileList, pkgText))
    .map((r) => r.name);

  return {
    id: base.id,
    owner: base.owner,
    name: base.name,
    url: base.url,
    topic: base.topic,
    status: base.status,
    localPath: base.localPath,
    createdAt: base.createdAt ?? now,
    updatedAt: now,
    pushedAt: null,
    stars: null,
    forks: null,
    openIssues: null,
    defaultBranch: null,
    license: null,
    primaryLanguage: null,
    topics: [],
    hasReadme: Boolean(readmePath),
    hasLicense: Boolean(licensePath),
    hasPackageJson: existsSync(pkgPath),
    hasTests: fileList.some((f) => /(^|\/)(test|tests|__tests__)\b/i.test(f) || /\.test\.[jt]sx?$/.test(f)),
    hasDocs: fileList.some((f) => f.startsWith('docs/') || /^docs?$/i.test(f)),
    hasExamples: fileList.some((f) => f.startsWith('examples/') || /^example(s)?$/i.test(f)),
    packageManager: detectPackageManager(fileList),
    detectedFrameworks: frameworks,
    topLevelTree: topLevel.slice(0, 60),
    fileCount: fileItems.length,
    createdBy: 'builderbrain',
    createdAtLocal: now,
  };
}
