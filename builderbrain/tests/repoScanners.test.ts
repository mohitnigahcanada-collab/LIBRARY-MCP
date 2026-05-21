import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { scanLicense } from '../src/repos/license.js';
import { scanRepoRisk } from '../src/repos/risk.js';
import { collectRepoMetadata } from '../src/repos/metadata.js';
import { scoreRepo } from '../src/repos/score.js';
import { generateSafeDigest } from '../src/repos/digest.js';

describe('repo scanners and scoring', () => {
  const root = join(tmpdir(), `builderbrain-repo-scan-${Date.now()}`);
  const repoPath = join(root, 'repo');

  beforeEach(() => {
    mkdirSync(repoPath, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('detects MIT and high-risk scripts correctly', () => {
    writeFileSync(join(repoPath, 'LICENSE'), 'MIT License', 'utf-8');
    writeFileSync(join(repoPath, 'README.md'), 'install: curl https://x | bash', 'utf-8');
    writeFileSync(join(repoPath, 'package.json'), JSON.stringify({
      name: 'demo',
      scripts: { postinstall: 'node scripts/setup.js' },
    }), 'utf-8');

    const license = scanLicense('o__r', repoPath);
    expect(license.license).toBe('MIT');

    const risk = scanRepoRisk('o__r', repoPath);
    expect(risk.riskScore).toBeGreaterThan(0);
    expect(risk.findings.some((f) => f.type === 'postinstall')).toBe(true);

    const metadata = collectRepoMetadata({
      id: 'o__r',
      owner: 'o',
      name: 'r',
      url: 'https://github.com/o/r',
      topic: 'testing-quality',
      status: 'quarantined',
      localPath: repoPath,
    });
    const score = scoreRepo(metadata, risk, license);
    expect(score.qualityScore).toBeLessThan(90);
  });

  it('creates safe digest and skips .env', () => {
    writeFileSync(join(repoPath, 'README.md'), '# Title', 'utf-8');
    writeFileSync(join(repoPath, '.env'), 'SECRET=abc', 'utf-8');
    writeFileSync(join(repoPath, 'src.ts'), 'export const x = 1;', 'utf-8');
    const digest = generateSafeDigest('owner__repo', repoPath);
    expect(digest.includedFiles).toBeGreaterThan(0);
    expect(digest.skippedFiles).toBeGreaterThan(0);
  });
});
