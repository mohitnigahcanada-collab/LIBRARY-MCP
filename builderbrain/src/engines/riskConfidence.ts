import { Domain } from './classifier.js';

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';
export type ConfidenceLevel = 'Low' | 'Medium' | 'High';

export interface RiskResult {
  level: RiskLevel;
  score: number;
  reasons: string[];
  approvalRequired: boolean;
}

export interface ConfidenceResult {
  level: ConfidenceLevel;
  score: number;
  reasons: string[];
}

const HIGH_RISK_KEYWORDS = ['delete', 'drop', 'remove', 'destroy', 'production', 'prod', 'migrate', 'deploy', 'overwrite', 'truncate'];
const CRITICAL_RISK_KEYWORDS = ['drop database', 'delete all', 'reset production', 'wipe', 'rm -rf'];

export function assessRisk(task: string, domains: Domain[]): RiskResult {
  const lower = task.toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  if (CRITICAL_RISK_KEYWORDS.some((kw) => lower.includes(kw))) {
    score = 100;
    reasons.push('Task contains critical destructive keyword');
    return { level: 'Critical', score, reasons, approvalRequired: true };
  }

  if (HIGH_RISK_KEYWORDS.some((kw) => lower.includes(kw))) {
    score += 40;
    reasons.push('Task contains high-risk keyword (delete/deploy/production)');
  }

  if (domains.includes('deployment')) {
    score += 25;
    reasons.push('Deployment domain detected');
  }

  if (domains.includes('database')) {
    score += 20;
    reasons.push('Database changes detected');
  }

  if (domains.includes('auth') || domains.includes('security')) {
    score += 15;
    reasons.push('Auth/security domain detected');
  }

  if (domains.includes('payments')) {
    score += 20;
    reasons.push('Payments domain detected');
  }

  let level: RiskLevel;
  if (score >= 75) level = 'Critical';
  else if (score >= 45) level = 'High';
  else if (score >= 20) level = 'Medium';
  else {
    level = 'Low';
    reasons.push('No high-risk indicators detected');
  }

  return {
    level,
    score: Math.min(score, 100),
    reasons,
    approvalRequired: level === 'High' || level === 'Critical',
  };
}

export function assessConfidence(task: string, domains: Domain[], hasPriorLessons: boolean): ConfidenceResult {
  const reasons: string[] = [];
  let score = 30;

  if (domains.length > 0) {
    score += 15;
    reasons.push(`${domains.length} domain(s) clearly identified`);
  }

  if (domains.length >= 2) {
    score += 10;
    reasons.push('Multiple domains matched — broad context available');
  }

  if (hasPriorLessons) {
    score += 20;
    reasons.push('Prior solved lessons found in self-learning memory');
  }

  if (task.length > 30) {
    score += 10;
    reasons.push('Task description is specific and detailed');
  }

  if (task.length < 10) {
    score -= 15;
    reasons.push('Task description is very short — low specificity');
  }

  score = Math.min(Math.max(score, 0), 100);

  let level: ConfidenceLevel;
  if (score >= 70) level = 'High';
  else if (score >= 40) level = 'Medium';
  else level = 'Low';

  return { level, score, reasons };
}
