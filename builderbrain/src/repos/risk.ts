import { readFileSync } from 'fs';
import { join } from 'path';
import { RepoRiskReport, RiskFinding } from './types.js';
import { safeReadText, walkRepoFiles } from './fsUtils.js';

const TEXT_EXT = new Set([
  '.md', '.txt', '.json', '.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs', '.yml', '.yaml',
  '.toml', '.ini', '.sh', '.bash', '.zsh', '.py', '.go', '.rs', '.java', '.kt', '.rb', '.php',
]);

const PATTERNS: Array<{ type: string; regex: RegExp; severity: RiskFinding['severity']; message: string }> = [
  { type: 'postinstall', regex: /postinstall/i, severity: 'High', message: 'Contains postinstall script' },
  { type: 'preinstall', regex: /preinstall/i, severity: 'High', message: 'Contains preinstall script' },
  { type: 'curl-bash', regex: /curl\s+[^|]+\|\s*(bash|sh)/i, severity: 'High', message: 'Contains curl | bash pattern' },
  { type: 'wget-bash', regex: /wget\s+[^|]+\|\s*(bash|sh)/i, severity: 'High', message: 'Contains wget | bash pattern' },
  { type: 'rm-rf', regex: /rm\s+-rf\b/i, severity: 'High', message: 'Contains rm -rf command' },
  { type: 'sudo', regex: /\bsudo\b/i, severity: 'Medium', message: 'Contains sudo command' },
  { type: 'chmod-777', regex: /chmod\s+777/i, severity: 'High', message: 'Contains chmod 777' },
  { type: 'eval', regex: /\beval\b/i, severity: 'Medium', message: 'Contains eval usage' },
  { type: 'node-e', regex: /node\s+-e\b/i, severity: 'Medium', message: 'Contains node -e execution' },
  { type: 'bash-c', regex: /bash\s+-c\b/i, severity: 'Medium', message: 'Contains bash -c execution' },
  { type: 'docker-privileged', regex: /--privileged|privileged:\s*true/i, severity: 'High', message: 'Contains privileged docker config' },
];

function extension(path: string): string {
  const i = path.lastIndexOf('.');
  return i >= 0 ? path.slice(i).toLowerCase() : '';
}

export function scanRepoRisk(repoId: string, repoPath: string): RepoRiskReport {
  const findings: RiskFinding[] = [];
  const files = walkRepoFiles(repoPath, 10_000);
  let largeFileCount = 0;
  let suspiciousBinaryCount = 0;

  for (const file of files) {
    const rel = file.relativePath;
    const lower = rel.toLowerCase();

    if (lower.endsWith('.env') || lower.includes('.env.')) {
      findings.push({ type: 'env-file', file: rel, severity: 'Medium', message: 'Environment file present' });
    }
    if (lower.includes('id_rsa') || lower.endsWith('.pem') || lower.endsWith('.key') || lower.includes('private_key')) {
      findings.push({ type: 'private-key-file', file: rel, severity: 'High', message: 'Potential private key file present' });
    }
    if (file.size > 5 * 1024 * 1024) {
      largeFileCount += 1;
    }

    const ext = extension(rel);
    if (!TEXT_EXT.has(ext) && !rel.endsWith('package.json') && !rel.toLowerCase().includes('readme')) {
      if (file.size > 2 * 1024 * 1024) suspiciousBinaryCount += 1;
      continue;
    }

    const text = safeReadText(file.absolutePath, 150_000);
    for (const pattern of PATTERNS) {
      if (pattern.regex.test(text)) {
        findings.push({
          type: pattern.type,
          file: rel,
          severity: pattern.severity,
          message: pattern.message,
        });
      }
    }

    if (rel === 'package.json') {
      try {
        const pkg = JSON.parse(readFileSync(join(repoPath, rel), 'utf-8')) as { scripts?: Record<string, string> };
        const scripts = pkg.scripts ?? {};
        if (scripts.postinstall) findings.push({ type: 'postinstall', file: rel, severity: 'High', message: 'package.json contains postinstall' });
        if (scripts.preinstall) findings.push({ type: 'preinstall', file: rel, severity: 'High', message: 'package.json contains preinstall' });
      } catch {
        // ignore
      }
    }
  }

  if (largeFileCount > 0) {
    findings.push({
      type: 'large-files',
      file: '*',
      severity: 'Medium',
      message: `Contains ${largeFileCount} files above 5MB`,
    });
  }
  if (suspiciousBinaryCount > 0) {
    findings.push({
      type: 'binary-blobs',
      file: '*',
      severity: 'Medium',
      message: `Contains ${suspiciousBinaryCount} potentially binary large files`,
    });
  }

  const score = findings.reduce((sum, item) => {
    if (item.severity === 'High') return sum + 18;
    if (item.severity === 'Medium') return sum + 8;
    return sum + 3;
  }, 0);

  const riskScore = Math.max(0, Math.min(100, score));
  const riskLevel: RepoRiskReport['riskLevel'] =
    riskScore >= 60 ? 'High' : riskScore >= 25 ? 'Medium' : 'Low';

  return {
    repoId,
    riskLevel,
    riskScore,
    findings,
    safeToExecute: false,
    safeToAnalyzeReadOnly: true,
  };
}
