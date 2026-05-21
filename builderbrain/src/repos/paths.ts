import { mkdirSync } from 'fs';
import { join } from 'path';
import { getWarehousePath } from '../storage/paths.js';

export function getBigBibleRoot(): string {
  return getWarehousePath();
}

export function getRepoRoot(): string {
  return join(getBigBibleRoot(), 'repos');
}

export function getRepoLogsPath(): string {
  return join(getRepoRoot(), 'logs', 'repo-actions.log');
}

export function getRepoQuarantineRoot(): string {
  return join(getRepoRoot(), 'quarantine');
}

export function getRepoAcceptedRoot(): string {
  return join(getRepoRoot(), 'accepted');
}

export function getRepoMetadataRoot(): string {
  return join(getRepoRoot(), 'metadata');
}

export function getRepoScorecardsRoot(): string {
  return join(getRepoRoot(), 'scorecards');
}

export function getRepoSummariesRoot(): string {
  return join(getRepoRoot(), 'summaries');
}

export function getRepoDigestsRoot(): string {
  return join(getRepoRoot(), 'digests');
}

export function getRepoRiskRoot(): string {
  return join(getRepoRoot(), 'risk');
}

export function ensureRepoStructure(): void {
  const dirs = [
    getRepoQuarantineRoot(),
    getRepoAcceptedRoot(),
    getRepoMetadataRoot(),
    getRepoScorecardsRoot(),
    getRepoSummariesRoot(),
    getRepoDigestsRoot(),
    getRepoRiskRoot(),
    join(getRepoRoot(), 'logs'),
    join(getBigBibleRoot(), 'research'),
  ];
  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true });
  }
}

export function getRepoLocalPath(repoId: string, status: 'quarantined' | 'accepted'): string {
  const base = status === 'accepted' ? getRepoAcceptedRoot() : getRepoQuarantineRoot();
  return join(base, repoId);
}

export function getMetadataPath(repoId: string): string {
  return join(getRepoMetadataRoot(), `${repoId}.json`);
}

export function getLicensePath(repoId: string): string {
  return join(getRepoScorecardsRoot(), `${repoId}.license.json`);
}

export function getScorePath(repoId: string): string {
  return join(getRepoScorecardsRoot(), `${repoId}.score.json`);
}

export function getRiskPath(repoId: string): string {
  return join(getRepoRiskRoot(), `${repoId}.risk.json`);
}

export function getSummaryPath(repoId: string): string {
  return join(getRepoSummariesRoot(), `${repoId}.md`);
}

export function getDigestPath(repoId: string): string {
  return join(getRepoDigestsRoot(), `${repoId}.md`);
}

export function getDigestSkippedPath(repoId: string): string {
  return join(getRepoDigestsRoot(), `${repoId}.skipped.json`);
}

export function getResearchCategoryRoot(categoryId: string): string {
  return join(getBigBibleRoot(), 'research', categoryId);
}

export function getCategoriesPath(): string {
  return join(getBigBibleRoot(), 'research', 'categories.json');
}
