import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { buildContextPack } from '../src/engines/contextPackBuilder.js';
import { assessRisk, assessConfidence } from '../src/engines/riskConfidence.js';
import { selectBookStack } from '../src/engines/bookRouter.js';
import { classifyDomains } from '../src/engines/classifier.js';

describe('context pack repo knowledge integration', () => {
  const originalCwd = process.cwd();
  const root = join(tmpdir(), `builderbrain-context-${Date.now()}`);
  const library = join(root, 'brain-data', 'library');
  const metadataRoot = join(root, 'brain-data', 'big-bible', 'repos', 'metadata');
  const summaryRoot = join(root, 'brain-data', 'big-bible', 'repos', 'summaries');
  const scoreRoot = join(root, 'brain-data', 'big-bible', 'repos', 'scorecards');

  beforeAll(() => {
    mkdirSync(join(library, 'pocket-rules'), { recursive: true });
    mkdirSync(join(library, 'mini-book'), { recursive: true });
    mkdirSync(join(library, 'self-learning'), { recursive: true });
    mkdirSync(join(library, 'user-style'), { recursive: true });
    mkdirSync(metadataRoot, { recursive: true });
    mkdirSync(summaryRoot, { recursive: true });
    mkdirSync(scoreRoot, { recursive: true });
    mkdirSync(join(root, 'brain-data', 'big-bible', 'research'), { recursive: true });

    writeFileSync(join(library, 'pocket-rules', 'before-coding.md'), 'rules', 'utf-8');
    writeFileSync(join(library, 'pocket-rules', 'approval-rules.md'), 'rules', 'utf-8');
    writeFileSync(join(library, 'pocket-rules', 'memory-rules.md'), 'rules', 'utf-8');
    writeFileSync(join(library, 'mini-book', 'security.md'), 'security', 'utf-8');
    writeFileSync(join(library, 'self-learning', 'solved-problems.md'), 'lessons', 'utf-8');
    writeFileSync(join(library, 'self-learning', 'architecture-decisions.md'), 'arch', 'utf-8');
    writeFileSync(join(library, 'user-style', 'communication-style.md'), 'direct', 'utf-8');
    writeFileSync(join(library, 'user-style', 'decision-style.md'), 'clear', 'utf-8');
    writeFileSync(join(library, 'user-style', 'do-not-ask-rules.md'), 'no loops', 'utf-8');

    writeFileSync(join(root, 'brain-data', 'big-bible', 'research', 'categories.json'), JSON.stringify([
      {
        id: 'ai-agent-frameworks',
        name: 'AI Agent Frameworks',
        description: '',
        searchTerms: ['mcp', 'agent'],
        topics: ['ai-agents'],
        preferredLanguages: ['TypeScript'],
      },
    ], null, 2), 'utf-8');
    writeFileSync(join(library, 'mini-book', 'ai-agent-frameworks.md'), '# mini', 'utf-8');

    writeFileSync(join(metadataRoot, 'demo__repo.json'), JSON.stringify({
      id: 'demo__repo',
      topic: 'ai-agent-frameworks',
      status: 'accepted',
    }), 'utf-8');
    writeFileSync(join(summaryRoot, 'demo__repo.md'), '# Repo Summary: demo/repo\nUseful MCP notes', 'utf-8');
    writeFileSync(join(scoreRoot, 'demo__repo.score.json'), JSON.stringify({ qualityScore: 88 }), 'utf-8');

    process.chdir(root);
  });

  afterAll(() => {
    process.chdir(originalCwd);
    rmSync(root, { recursive: true, force: true });
  });

  it('includes repo mini-book and summaries for matching task', () => {
    const task = 'build MCP server for repo intelligence';
    const domains = classifyDomains(task);
    const stack = selectBookStack(domains);
    const risk = assessRisk(task, domains);
    const confidence = assessConfidence(task, domains, true);
    const pack = buildContextPack(task, domains, stack, risk, confidence, join(root, 'brain-data', 'library'));
    expect(pack.repoCategories).toContain('ai-agent-frameworks');
    expect(pack.repoMiniBooks.length).toBeGreaterThan(0);
    expect(pack.repoSummaries.length).toBeGreaterThan(0);
  });
});
