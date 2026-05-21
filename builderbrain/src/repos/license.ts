import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { LicenseScorecard } from './types.js';
import { safeReadText } from './fsUtils.js';

function detectLicenseId(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('mit license')) return 'MIT';
  if (t.includes('apache license') || t.includes('apache-2.0')) return 'Apache-2.0';
  if (t.includes('bsd license')) return 'BSD';
  if (t.includes('gnu affero general public license') || t.includes('agpl')) return 'AGPL';
  if (t.includes('gnu lesser general public license') || t.includes('lgpl')) return 'LGPL';
  if (t.includes('gnu general public license') || /\bgpl\b/.test(t)) return 'GPL';
  if (t.includes('mozilla public license') || t.includes('mpl-2.0')) return 'MPL';
  return 'unknown';
}

function policyForLicense(license: string): Pick<LicenseScorecard, 'licenseRisk' | 'copyCodeAllowed' | 'recommendedUse' | 'warning'> {
  switch (license) {
    case 'MIT':
    case 'Apache-2.0':
    case 'BSD':
      return {
        licenseRisk: 'Low',
        copyCodeAllowed: false,
        recommendedUse: ['architecture', 'patterns', 'testing ideas'],
        warning: 'Do not copy directly unless project policy allows it.',
      };
    case 'GPL':
    case 'AGPL':
    case 'LGPL':
      return {
        licenseRisk: 'High',
        copyCodeAllowed: false,
        recommendedUse: ['architecture', 'concepts'],
        warning: 'Copyleft license. Treat as architecture learning unless user approves implications.',
      };
    case 'none':
      return {
        licenseRisk: 'High',
        copyCodeAllowed: false,
        recommendedUse: ['concepts'],
        warning: 'No license detected. Do not copy code.',
      };
    default:
      return {
        licenseRisk: 'Medium',
        copyCodeAllowed: false,
        recommendedUse: ['concepts', 'architecture'],
        warning: 'Unknown license. Treat as restricted.',
      };
  }
}

export function scanLicense(repoId: string, repoPath: string): LicenseScorecard {
  const topLevel = existsSync(repoPath) ? readdirSync(repoPath) : [];
  const licenseFile = topLevel.find((f) => /^license(\.|$)/i.test(f));
  const readmeFile = topLevel.find((f) => /^readme(\.|$)/i.test(f));

  let license = 'none';
  if (licenseFile) {
    license = detectLicenseId(safeReadText(join(repoPath, licenseFile), 100_000));
  } else if (readmeFile) {
    const maybe = detectLicenseId(safeReadText(join(repoPath, readmeFile), 100_000));
    license = maybe === 'unknown' ? 'unknown' : maybe;
  }

  const policy = policyForLicense(license);
  return {
    repoId,
    license,
    ...policy,
  };
}
