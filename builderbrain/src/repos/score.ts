import { LicenseScorecard, RepoMetadata, RepoRiskReport, RepoScorecard } from './types.js';

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function scoreRepo(
  metadata: RepoMetadata,
  risk: RepoRiskReport,
  license: LicenseScorecard
): RepoScorecard {
  let quality = 45;
  let learning = 50;

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (metadata.hasReadme) { quality += 12; learning += 10; strengths.push('README exists'); }
  else { quality -= 20; weaknesses.push('No README'); }

  if (metadata.hasLicense && license.license !== 'none' && license.license !== 'unknown') {
    quality += 8;
    strengths.push(`License: ${license.license}`);
  } else {
    quality -= 10;
    weaknesses.push('License missing/unclear');
  }

  if (metadata.hasTests) { quality += 10; learning += 10; strengths.push('Tests present'); }
  else { quality -= 10; weaknesses.push('No tests detected'); }

  if (metadata.hasDocs) { quality += 6; learning += 8; strengths.push('Docs present'); }
  else { weaknesses.push('No docs folder'); }

  if (metadata.hasExamples) { quality += 5; learning += 6; strengths.push('Examples present'); }

  if (metadata.hasPackageJson || metadata.packageManager) {
    quality += 4;
  } else {
    quality -= 4;
  }

  if (metadata.detectedFrameworks.length > 0) {
    quality += 5;
    learning += 8;
    strengths.push(`Detected frameworks: ${metadata.detectedFrameworks.slice(0, 4).join(', ')}`);
  } else {
    weaknesses.push('No known framework signals');
  }

  quality -= Math.round(risk.riskScore * 0.35);
  if (risk.riskLevel !== 'Low') weaknesses.push(`Risk level ${risk.riskLevel} (${risk.riskScore})`);

  if (license.licenseRisk === 'High') {
    quality -= 10;
    learning -= 5;
  } else if (license.licenseRisk === 'Medium') {
    quality -= 4;
  }

  const qualityScore = clamp(quality);
  const learningValueScore = clamp(learning - Math.round(risk.riskScore * 0.2));

  const finalVerdict =
    qualityScore >= 80 ? 'Strong reference' :
    qualityScore >= 60 ? 'Good reference' :
    qualityScore >= 40 ? 'Usable with caution' :
    'Low-quality reference';

  return {
    repoId: metadata.id,
    qualityScore,
    learningValueScore,
    riskLevel: risk.riskLevel,
    license: license.license,
    strengths,
    weaknesses,
    recommendedUse: license.recommendedUse,
    doNotUseFor: ['copying code blindly', 'executing untrusted scripts'],
    finalVerdict,
  };
}
