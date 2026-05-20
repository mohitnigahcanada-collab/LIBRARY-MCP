import { describe, it, expect } from 'vitest';
import { buildProposal, formatProposal } from '../src/engines/proposalEngine.js';
import { classifyDomains } from '../src/engines/classifier.js';
import { selectBookStack } from '../src/engines/bookRouter.js';
import { assessRisk, assessConfidence } from '../src/engines/riskConfidence.js';

function makeProposal(task: string) {
  const domains = classifyDomains(task);
  const bookStack = selectBookStack(domains);
  const risk = assessRisk(task, domains);
  const confidence = assessConfidence(task, domains, false);
  return buildProposal(task, domains, bookStack, risk, confidence);
}

describe('buildProposal', () => {
  it('sets approvalRequired for high-risk task', () => {
    const proposal = makeProposal('delete all user data from the database');
    expect(proposal.approvalRequired).toBe(true);
  });

  it('does not require approval for low-risk task', () => {
    const proposal = makeProposal('add a date formatting utility function');
    expect(proposal.approvalRequired).toBe(false);
  });

  it('includes planned actions', () => {
    const proposal = makeProposal('add oauth login');
    expect(proposal.plannedActions.length).toBeGreaterThan(0);
  });

  it('includes rollback plan', () => {
    const proposal = makeProposal('add a new api route');
    expect(proposal.rollback).toBeTruthy();
  });

  it('includes testing plan', () => {
    const proposal = makeProposal('add login endpoint');
    expect(proposal.testingPlan).toContain('npm test');
  });

  it('includes files to inspect', () => {
    const proposal = makeProposal('fix the auth bug');
    expect(proposal.filesToInspect.length).toBeGreaterThan(0);
  });
});

describe('formatProposal', () => {
  it('returns a string containing key sections', () => {
    const proposal = makeProposal('add user authentication with jwt');
    const formatted = formatProposal(proposal);
    expect(formatted).toContain('## Task');
    expect(formatted).toContain('## Risk');
    expect(formatted).toContain('## Confidence');
    expect(formatted).toContain('## Planned Actions');
    expect(formatted).toContain('## Rollback Plan');
  });
});
