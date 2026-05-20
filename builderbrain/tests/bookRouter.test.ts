import { describe, it, expect } from 'vitest';
import { selectBookStack } from '../src/engines/bookRouter.js';

describe('selectBookStack', () => {
  it('always includes pocket rules and user style books', () => {
    const stack = selectBookStack(['backend']);
    const paths = stack.map((b) => b.path);
    expect(paths).toContain('pocket-rules/before-coding.md');
    expect(paths).toContain('pocket-rules/approval-rules.md');
    expect(paths).toContain('user-style/communication-style.md');
    expect(paths).toContain('self-learning/solved-problems.md');
  });

  it('adds debugging books for debugging domain', () => {
    const stack = selectBookStack(['debugging']);
    const paths = stack.map((b) => b.path);
    expect(paths).toContain('mini-book/debugging.md');
    expect(paths).toContain('pocket-rules/before-debugging.md');
    expect(paths).toContain('self-learning/bug-patterns.md');
  });

  it('adds security book for auth domain', () => {
    const stack = selectBookStack(['auth']);
    const paths = stack.map((b) => b.path);
    expect(paths).toContain('mini-book/security.md');
  });

  it('deduplicates books when multiple domains share books', () => {
    const stack = selectBookStack(['auth', 'backend', 'security']);
    const paths = stack.map((b) => b.path);
    const unique = new Set(paths);
    expect(paths.length).toBe(unique.size);
  });

  it('adds testing book for testing domain', () => {
    const stack = selectBookStack(['testing']);
    const paths = stack.map((b) => b.path);
    expect(paths).toContain('mini-book/testing.md');
  });

  it('adds ai-agents book for ai-agents domain', () => {
    const stack = selectBookStack(['ai-agents']);
    const paths = stack.map((b) => b.path);
    expect(paths).toContain('mini-book/ai-agents.md');
  });
});
