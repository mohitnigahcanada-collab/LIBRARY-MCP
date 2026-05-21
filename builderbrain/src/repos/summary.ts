import { existsSync } from 'fs';
import { join } from 'path';
import { RepoMetadata, RepoRiskReport, LicenseScorecard, RepoScorecard } from './types.js';
import { safeReadText } from './fsUtils.js';

export function buildRepoSummaryMarkdown(input: {
  metadata: RepoMetadata;
  risk: RepoRiskReport;
  license: LicenseScorecard;
  score: RepoScorecard;
}): string {
  const { metadata, risk, license, score } = input;
  const readmePath = join(metadata.localPath, 'README.md');
  const readme = existsSync(readmePath) ? safeReadText(readmePath, 4000).trim() : '';
  const whatItIs = readme
    ? readme.split('\n').filter((l) => l.trim()).slice(0, 4).join(' ')
    : 'README summary not available.';

  const riskLines = risk.findings.length === 0
    ? '- No high-risk findings detected.'
    : risk.findings.slice(0, 8).map((f) => `- [${f.severity}] ${f.file}: ${f.message}`).join('\n');

  return `# Repo Summary: ${metadata.owner}/${metadata.name}

## Topic
${metadata.topic || 'general'}

## Status
${metadata.status}

## What It Is
${whatItIs}

## Why It Matters
Quality score: ${score.qualityScore}/100, Learning score: ${score.learningValueScore}/100.

## Architecture Lessons
${score.strengths.length > 0 ? score.strengths.map((x) => `- ${x}`).join('\n') : '- Not enough architecture signals yet.'}

## Folder Structure Lessons
${metadata.topLevelTree.slice(0, 20).map((x) => `- ${x}`).join('\n')}

## Testing Lessons
${metadata.hasTests ? '- Tests are present; inspect test style before implementing.' : '- Tests were not detected; treat examples cautiously.'}

## Security Warnings
Risk level: ${risk.riskLevel} (${risk.riskScore}/100)
${riskLines}

## Anti-Patterns
${score.weaknesses.length > 0 ? score.weaknesses.map((x) => `- ${x}`).join('\n') : '- None flagged.'}

## How BuilderBrain Should Use This
${score.recommendedUse.map((x) => `- ${x}`).join('\n')}

## License / Copying Warning
License: ${license.license} (${license.licenseRisk})
${license.warning}

## Final Verdict
${score.finalVerdict}
`;
}
