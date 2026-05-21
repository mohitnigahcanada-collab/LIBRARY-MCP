export type RepoStatus = 'quarantined' | 'analyzed' | 'accepted' | 'rejected' | 'error';

export interface RepoMetadata {
  id: string;
  owner: string;
  name: string;
  url: string;
  topic: string;
  status: RepoStatus;
  localPath: string;
  createdAt: string;
  updatedAt: string;
  pushedAt: string | null;
  stars: number | null;
  forks: number | null;
  openIssues: number | null;
  defaultBranch: string | null;
  license: string | null;
  primaryLanguage: string | null;
  topics: string[];
  hasReadme: boolean;
  hasLicense: boolean;
  hasPackageJson: boolean;
  hasTests: boolean;
  hasDocs: boolean;
  hasExamples: boolean;
  packageManager: string | null;
  detectedFrameworks: string[];
  topLevelTree: string[];
  fileCount: number;
  createdBy: 'builderbrain';
  createdAtLocal: string;
}

export interface LicenseScorecard {
  repoId: string;
  license: string;
  licenseRisk: 'Low' | 'Medium' | 'High';
  copyCodeAllowed: boolean;
  recommendedUse: string[];
  warning: string;
}

export interface RiskFinding {
  type: string;
  file: string;
  severity: 'Low' | 'Medium' | 'High';
  message: string;
}

export interface RepoRiskReport {
  repoId: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  riskScore: number;
  findings: RiskFinding[];
  safeToExecute: false;
  safeToAnalyzeReadOnly: true;
}

export interface RepoScorecard {
  repoId: string;
  qualityScore: number;
  learningValueScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  license: string;
  strengths: string[];
  weaknesses: string[];
  recommendedUse: string[];
  doNotUseFor: string[];
  finalVerdict: string;
}

export interface RepoDigestResult {
  repoId: string;
  digestPath: string;
  skippedPath: string;
  includedFiles: number;
  skippedFiles: number;
}

export interface RepoAddResult {
  success: boolean;
  repoId: string;
  repoName: string;
  message: string;
  metadataPath?: string;
}
