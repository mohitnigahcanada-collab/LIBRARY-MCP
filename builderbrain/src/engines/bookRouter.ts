import { Domain } from './classifier.js';

export interface BookEntry {
  path: string;
  label: string;
}

const ALWAYS_INCLUDE: BookEntry[] = [
  { path: 'pocket-rules/before-coding.md', label: 'Before Coding Rules' },
  { path: 'pocket-rules/approval-rules.md', label: 'Approval Rules' },
  { path: 'pocket-rules/memory-rules.md', label: 'Memory Rules' },
  { path: 'user-style/communication-style.md', label: 'Communication Style' },
  { path: 'user-style/decision-style.md', label: 'Decision Style' },
  { path: 'user-style/do-not-ask-rules.md', label: 'Do Not Ask Rules' },
  { path: 'self-learning/solved-problems.md', label: 'Solved Problems' },
  { path: 'self-learning/architecture-decisions.md', label: 'Architecture Decisions' },
];

const DOMAIN_BOOKS: Partial<Record<Domain, BookEntry[]>> = {
  auth: [{ path: 'mini-book/security.md', label: 'Security' }, { path: 'mini-book/software-engineering.md', label: 'Software Engineering' }],
  database: [{ path: 'mini-book/software-engineering.md', label: 'Software Engineering' }, { path: 'self-learning/architecture-decisions.md', label: 'Architecture Decisions' }],
  payments: [{ path: 'mini-book/security.md', label: 'Security' }, { path: 'mini-book/software-engineering.md', label: 'Software Engineering' }],
  security: [{ path: 'mini-book/security.md', label: 'Security' }, { path: 'pocket-rules/before-coding.md', label: 'Before Coding Rules' }],
  testing: [{ path: 'mini-book/testing.md', label: 'Testing' }, { path: 'mini-book/software-engineering.md', label: 'Software Engineering' }],
  debugging: [{ path: 'mini-book/debugging.md', label: 'Debugging' }, { path: 'pocket-rules/before-debugging.md', label: 'Before Debugging Rules' }, { path: 'self-learning/bug-patterns.md', label: 'Bug Patterns' }],
  frontend: [{ path: 'mini-book/software-engineering.md', label: 'Software Engineering' }, { path: 'mini-book/testing.md', label: 'Testing' }],
  backend: [{ path: 'mini-book/software-engineering.md', label: 'Software Engineering' }, { path: 'mini-book/security.md', label: 'Security' }],
  'ai-agents': [{ path: 'mini-book/ai-agents.md', label: 'AI Agents' }, { path: 'mini-book/security.md', label: 'Security' }],
  product: [{ path: 'mini-book/product-building.md', label: 'Product Building' }],
  deployment: [{ path: 'mini-book/security.md', label: 'Security' }, { path: 'self-learning/architecture-decisions.md', label: 'Architecture Decisions' }],
  files: [{ path: 'mini-book/software-engineering.md', label: 'Software Engineering' }, { path: 'mini-book/security.md', label: 'Security' }],
  'browser-automation': [{ path: 'mini-book/software-engineering.md', label: 'Software Engineering' }, { path: 'mini-book/security.md', label: 'Security' }],
  documentation: [{ path: 'mini-book/software-engineering.md', label: 'Software Engineering' }],
};

export function selectBookStack(domains: Domain[]): BookEntry[] {
  const seen = new Set<string>();
  const stack: BookEntry[] = [];

  for (const book of ALWAYS_INCLUDE) {
    if (!seen.has(book.path)) {
      seen.add(book.path);
      stack.push(book);
    }
  }

  for (const domain of domains) {
    const extras = DOMAIN_BOOKS[domain] ?? [];
    for (const book of extras) {
      if (!seen.has(book.path)) {
        seen.add(book.path);
        stack.push(book);
      }
    }
  }

  return stack;
}
