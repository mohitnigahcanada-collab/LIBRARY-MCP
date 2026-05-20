import { describe, it, expect } from 'vitest';
import { classifyDomains } from '../src/engines/classifier.js';

describe('classifyDomains', () => {
  it('detects auth domain', () => {
    const domains = classifyDomains('add login with oauth to express app');
    expect(domains).toContain('auth');
  });

  it('detects database domain', () => {
    const domains = classifyDomains('run a postgres migration to add user table');
    expect(domains).toContain('database');
  });

  it('detects debugging domain', () => {
    const domains = classifyDomains('fix the bug causing crash on login');
    expect(domains).toContain('debugging');
  });

  it('detects multiple domains', () => {
    const domains = classifyDomains('fix auth bug in the login sql query');
    expect(domains).toContain('auth');
    expect(domains).toContain('debugging');
    expect(domains).toContain('database');
  });

  it('returns backend as default when no domain matches', () => {
    const domains = classifyDomains('do the thing');
    expect(domains).toContain('backend');
  });

  it('detects security domain', () => {
    const domains = classifyDomains('sanitize input to prevent xss');
    expect(domains).toContain('security');
  });

  it('detects testing domain', () => {
    const domains = classifyDomains('write vitest unit tests for the classifier');
    expect(domains).toContain('testing');
  });

  it('detects ai-agents domain', () => {
    const domains = classifyDomains('build a claude mcp tool for context generation');
    expect(domains).toContain('ai-agents');
  });
});
