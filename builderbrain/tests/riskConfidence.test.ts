import { describe, it, expect } from 'vitest';
import { assessRisk, assessConfidence } from '../src/engines/riskConfidence.js';

describe('assessRisk', () => {
  it('rates low risk for a simple feature task', () => {
    const result = assessRisk('add a helper function to format dates', ['backend']);
    expect(result.level).toBe('Low');
    expect(result.approvalRequired).toBe(false);
  });

  it('rates high risk for a delete operation', () => {
    const result = assessRisk('delete all user records from the database', ['database']);
    expect(['High', 'Critical']).toContain(result.level);
    expect(result.approvalRequired).toBe(true);
  });

  it('rates critical for drop database', () => {
    const result = assessRisk('drop database production', ['database', 'deployment']);
    expect(result.level).toBe('Critical');
    expect(result.approvalRequired).toBe(true);
  });

  it('raises risk for deployment domain', () => {
    const result = assessRisk('deploy to production', ['deployment']);
    expect(['High', 'Critical']).toContain(result.level);
  });

  it('includes reasons in result', () => {
    const result = assessRisk('drop database production', ['database']);
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});

describe('assessConfidence', () => {
  it('returns higher confidence with prior lessons', () => {
    const withLessons = assessConfidence('add oauth login', ['auth'], true);
    const withoutLessons = assessConfidence('add oauth login', ['auth'], false);
    expect(withLessons.score).toBeGreaterThan(withoutLessons.score);
  });

  it('returns higher confidence with specific task description', () => {
    const specific = assessConfidence('add JWT authentication to the express middleware using jsonwebtoken package', ['auth', 'backend'], false);
    const vague = assessConfidence('fix it', ['backend'], false);
    expect(specific.score).toBeGreaterThan(vague.score);
  });

  it('includes reasons in result', () => {
    const result = assessConfidence('add login', ['auth'], false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('level matches score ranges', () => {
    const result = assessConfidence('add oauth login to the express app using passport.js', ['auth', 'backend'], true);
    if (result.score >= 70) expect(result.level).toBe('High');
    else if (result.score >= 40) expect(result.level).toBe('Medium');
    else expect(result.level).toBe('Low');
  });
});
