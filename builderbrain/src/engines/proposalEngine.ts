import { Domain } from './classifier.js';
import { BookEntry } from './bookRouter.js';
import { RiskResult, ConfidenceResult } from './riskConfidence.js';

export interface Proposal {
  task: string;
  domains: Domain[];
  confidence: ConfidenceResult;
  risk: RiskResult;
  approvalRequired: boolean;
  reason: string;
  evidence: string[];
  plannedActions: string[];
  filesToInspect: string[];
  rollback: string;
  testingPlan: string;
  recommendation: string;
  bookStack: BookEntry[];
}

export function buildProposal(
  task: string,
  domains: Domain[],
  bookStack: BookEntry[],
  risk: RiskResult,
  confidence: ConfidenceResult
): Proposal {
  const approvalRequired = risk.approvalRequired;

  const reason = [
    `Task domains: ${domains.join(', ')}.`,
    `Confidence: ${confidence.level} (${confidence.score}/100) — ${confidence.reasons.join('; ')}.`,
    `Risk: ${risk.level} (${risk.score}/100) — ${risk.reasons.join('; ')}.`,
  ].join(' ');

  const evidence = [
    `Domains detected: ${domains.join(', ')}`,
    `Books selected: ${bookStack.map((b) => b.label).join(', ')}`,
    `Risk score: ${risk.score}/100 (${risk.level})`,
    `Confidence score: ${confidence.score}/100 (${confidence.level})`,
  ];

  const plannedActions = [
    'Review selected book stack for relevant patterns',
    'Check self-learning memory for prior solutions',
    'Write implementation following key rules',
    'Run unit tests',
    'Run npm test and npm run build',
    'Verify behavior manually',
    'Save lesson to self-learning memory',
  ];

  if (approvalRequired) {
    plannedActions.unshift('⚠️  STOP — get explicit approval before executing');
  }

  const filesToInspect: string[] = bookStack.map((b) => `brain-data/library/${b.path}`);

  const rollback = risk.level === 'Low' || risk.level === 'Medium'
    ? 'Git revert the changes if behavior is incorrect'
    : 'Ensure backup exists before executing; document rollback steps explicitly';

  const testingPlan = [
    'Unit test each new function',
    'Integration test the affected flow end-to-end',
    'Run `npm test` — all must pass',
    'Run `npm run build` — must compile clean',
    'Manual test: happy path',
    'Manual test: primary error case',
  ].join('\n- ');

  const recommendation = approvalRequired
    ? `⚠️  Risk is ${risk.level} — do NOT execute until approved. Present this proposal and wait for sign-off.`
    : `✅ Safe to proceed. Confidence is ${confidence.level} — execute with full context pack.`;

  return {
    task,
    domains,
    confidence,
    risk,
    approvalRequired,
    reason,
    evidence,
    plannedActions,
    filesToInspect,
    rollback,
    testingPlan: '- ' + testingPlan,
    recommendation,
    bookStack,
  };
}

export function formatProposal(proposal: Proposal): string {
  return `# BuilderBrain Proposal

## Task
${proposal.task}

## Detected Domains
${proposal.domains.join(', ')}

## Confidence
Level: ${proposal.confidence.level} | Score: ${proposal.confidence.score}/100
${proposal.confidence.reasons.map((r) => `- ${r}`).join('\n')}

## Risk
Level: ${proposal.risk.level} | Score: ${proposal.risk.score}/100
${proposal.risk.reasons.map((r) => `- ${r}`).join('\n')}

## Approval Required
${proposal.approvalRequired ? '⚠️  YES — do not execute without explicit sign-off' : '✅ No — safe to execute autonomously'}

## Reason
${proposal.reason}

## Evidence
${proposal.evidence.map((e) => `- ${e}`).join('\n')}

## Planned Actions
${proposal.plannedActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}

## Files to Inspect
${proposal.filesToInspect.map((f) => `- ${f}`).join('\n')}

## Rollback Plan
${proposal.rollback}

## Testing Plan
${proposal.testingPlan}

## Recommendation
${proposal.recommendation}
`;
}
