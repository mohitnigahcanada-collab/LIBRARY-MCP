import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Domain } from './classifier.js';
import { BookEntry } from './bookRouter.js';
import { RiskResult, ConfidenceResult } from './riskConfidence.js';
import { buildRepoContextForTask } from '../repos/context.js';

export interface ContextPack {
  task: string;
  detectedDomains: Domain[];
  bookStack: BookEntry[];
  keyRules: string;
  relevantKnowledge: string;
  knownLessons: string;
  antipatterns: string;
  recommendedPlan: string;
  testingChecklist: string;
  approvalWarning: string;
  repoCategories: string[];
  repoMiniBooks: Array<{ category: string; path: string; content: string }>;
  repoSummaries: Array<{ repoId: string; path: string; content: string; score: number }>;
  repoSafetyWarnings: string[];
  risk: RiskResult;
  confidence: ConfidenceResult;
}

function readBook(libraryPath: string, bookPath: string): string {
  const full = join(libraryPath, bookPath);
  if (!existsSync(full)) return `[Book not found: ${bookPath}]`;
  return readFileSync(full, 'utf-8');
}

function extractSection(content: string, heading: string): string {
  const lines = content.split('\n');
  const idx = lines.findIndex((l) => l.toLowerCase().includes(heading.toLowerCase()));
  if (idx === -1) return '';
  const section: string[] = [];
  for (let i = idx + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ') && i !== idx) break;
    section.push(lines[i]);
  }
  return section.join('\n').trim();
}

export function buildContextPack(
  task: string,
  domains: Domain[],
  bookStack: BookEntry[],
  risk: RiskResult,
  confidence: ConfidenceResult,
  libraryPath: string
): ContextPack {
  const pocketRuleBooks = bookStack.filter((b) => b.path.startsWith('pocket-rules'));
  const knowledgeBooks = bookStack.filter((b) => b.path.startsWith('mini-book'));
  const lessonBooks = bookStack.filter((b) => b.path.startsWith('self-learning'));

  const keyRules = pocketRuleBooks
    .map((b) => `### ${b.label}\n${readBook(libraryPath, b.path)}`)
    .join('\n\n');

  const relevantKnowledge = knowledgeBooks
    .map((b) => `### ${b.label}\n${readBook(libraryPath, b.path)}`)
    .join('\n\n');

  const knownLessons = lessonBooks
    .map((b) => `### ${b.label}\n${readBook(libraryPath, b.path)}`)
    .join('\n\n');

  const antipatterns = knowledgeBooks
    .map((b) => {
      const content = readBook(libraryPath, b.path);
      const section = extractSection(content, 'antipattern');
      return section ? `**${b.label}:**\n${section}` : '';
    })
    .filter(Boolean)
    .join('\n\n');

  const recommendedPlan = [
    `1. Classify and confirm task domains: ${domains.join(', ')}`,
    '2. Review key rules above before writing code',
    '3. Check known lessons for prior solutions',
    '4. Write a brief proposal with rollback plan',
    risk.approvalRequired ? '5. ⚠️  GET APPROVAL before executing — risk is ' + risk.level : '5. Execute autonomously — risk is Low/Medium',
    '6. Run tests after implementation',
    '7. Save lesson to self-learning memory',
  ].join('\n');

  const testingChecklist = [
    '- [ ] Unit tests for new functions',
    '- [ ] Integration test for the affected flow',
    '- [ ] npm test passes',
    '- [ ] npm run build passes',
    '- [ ] Manual verification of happy path',
    '- [ ] Manual verification of key error case',
  ].join('\n');

  const approvalWarning = risk.approvalRequired
    ? `⚠️  APPROVAL REQUIRED — Risk Level: ${risk.level}\nReasons: ${risk.reasons.join('; ')}`
    : `✅ No approval required — Risk Level: ${risk.level}`;

  const repoContext = buildRepoContextForTask(task);

  return {
    task,
    detectedDomains: domains,
    bookStack,
    keyRules,
    relevantKnowledge,
    knownLessons,
    antipatterns,
    recommendedPlan,
    testingChecklist,
    approvalWarning,
    repoCategories: repoContext.categories,
    repoMiniBooks: repoContext.miniBooks,
    repoSummaries: repoContext.repoSummaries,
    repoSafetyWarnings: repoContext.safetyWarnings,
    risk,
    confidence,
  };
}

export function formatContextPack(pack: ContextPack): string {
  return `# BuilderBrain Context Pack

## Task
${pack.task}

## Detected Domains
${pack.detectedDomains.join(', ')}

## Book Stack Selected
${pack.bookStack.map((b) => `- ${b.label} (${b.path})`).join('\n')}

## Risk / Confidence
- Risk: ${pack.risk.level} (score: ${pack.risk.score}) — ${pack.risk.reasons.join('; ')}
- Confidence: ${pack.confidence.level} (score: ${pack.confidence.score}) — ${pack.confidence.reasons.join('; ')}

## Approval Warning
${pack.approvalWarning}

## Key Rules
${pack.keyRules}

## Relevant Knowledge
${pack.relevantKnowledge}

## Known Lessons
${pack.knownLessons}

## Antipatterns to Avoid
${pack.antipatterns || 'None found in selected books.'}

## Recommended Plan
${pack.recommendedPlan}

## Testing Checklist
${pack.testingChecklist}

## Repo Knowledge Categories
${pack.repoCategories.length > 0 ? pack.repoCategories.map((c) => `- ${c}`).join('\n') : 'None matched for this task.'}

## Repo Mini Books
${pack.repoMiniBooks.length > 0
  ? pack.repoMiniBooks.map((b) => `### ${b.category}\n${b.content}`).join('\n\n')
  : 'No category mini-books found for this task.'}

## Top Repo Summaries
${pack.repoSummaries.length > 0
  ? pack.repoSummaries.map((s) => `### ${s.repoId} (score ${s.score})\n${s.content}`).join('\n\n')
  : 'No analyzed repo summaries matched.'}

## Repo Safety Warnings
${pack.repoSafetyWarnings.map((w) => `- ${w}`).join('\n')}
`;
}
