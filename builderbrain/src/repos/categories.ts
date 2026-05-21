import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getCategoriesPath, getResearchCategoryRoot } from './paths.js';

export interface ResearchCategory {
  id: string;
  name: string;
  description: string;
  searchTerms: string[];
  topics: string[];
  preferredLanguages: string[];
}

const CATEGORY_IDS = [
  'saas-product-systems',
  'frontend-engineering',
  'backend-engineering',
  'database-storage',
  'ai-app-systems',
  'ai-agent-frameworks',
  'rag-knowledge-systems',
  'data-engineering',
  'cloud-devops-infra',
  'observability-reliability',
  'security-engineering',
  'testing-quality',
  'browser-desktop-automation',
  'mobile-cross-platform',
  'ai-model-engineering',
  'computer-vision-media-ai',
  'voice-speech-audio',
  'robotics-iot-hardware',
  'simulation-digital-twins',
  'scientific-computing',
  'finance-trading',
  'blockchain-web3',
  'game-development',
  'collaboration-communication',
  'search-indexing-recommendation',
  'workflow-automation',
  'api-integrations',
  'design-creative-tools',
  'education-learning',
  'business-operations',
  'legal-compliance-governance',
  'geospatial-mapping',
  'low-level-systems',
  'performance-engineering',
  'docs-devex',
  'cli-terminal-tools',
  'local-first-apps',
  'ai-coding-agents',
  'prompt-eval-observability',
  'dataset-synthetic-data',
  'web-scraping-crawling',
  'file-document-processing',
  'knowledge-graphs',
  'monorepo-build-systems',
  'open-source-infra-governance',
];

export const DEFAULT_CATEGORIES: ResearchCategory[] = CATEGORY_IDS.map((id) => ({
  id,
  name: id.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' '),
  description: `${id.replace(/-/g, ' ')} systems and practical implementation patterns.`,
  searchTerms: [id.replace(/-/g, ' ')],
  topics: id.split('-').slice(0, 3),
  preferredLanguages: ['TypeScript', 'Python'],
}));

for (const category of DEFAULT_CATEGORIES) {
  if (category.id === 'ai-agent-frameworks') {
    category.description = 'Agent systems, tool use, planning, memory, orchestration.';
    category.searchTerms = ['ai agent framework', 'langgraph', 'autogen', 'crewai', 'openhands', 'mcp server', 'model context protocol'];
    category.topics = ['ai-agents', 'llm', 'agent-framework'];
  } else if (category.id === 'docs-devex') {
    category.searchTerms = ['developer experience', 'docs tooling', 'sdk docs', 'mcp docs'];
  } else if (category.id === 'cli-terminal-tools') {
    category.searchTerms = ['cli tool', 'terminal automation', 'command line', 'mcp cli'];
  } else if (category.id === 'ai-coding-agents') {
    category.searchTerms = ['coding agent', 'code assistant', 'ai coding', 'repo intelligence'];
  }
}

export function ensureCategoriesFile(): ResearchCategory[] {
  const path = getCategoriesPath();
  mkdirSync(join(process.cwd(), 'brain-data', 'big-bible', 'research'), { recursive: true });
  if (!existsSync(path)) {
    writeFileSync(path, JSON.stringify(DEFAULT_CATEGORIES, null, 2), 'utf-8');
    return DEFAULT_CATEGORIES;
  }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as ResearchCategory[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      writeFileSync(path, JSON.stringify(DEFAULT_CATEGORIES, null, 2), 'utf-8');
      return DEFAULT_CATEGORIES;
    }
    const byId = new Map(parsed.map((c) => [c.id, c]));
    const merged = DEFAULT_CATEGORIES.map((def) => {
      const existing = byId.get(def.id);
      if (!existing) return def;
      const searchTerms = Array.from(new Set([...(existing.searchTerms ?? []), ...def.searchTerms]));
      const topics = Array.from(new Set([...(existing.topics ?? []), ...def.topics]));
      const preferredLanguages = Array.from(new Set([...(existing.preferredLanguages ?? []), ...def.preferredLanguages]));
      return {
        ...def,
        ...existing,
        searchTerms,
        topics,
        preferredLanguages,
      };
    });
    writeFileSync(path, JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
  } catch {
    writeFileSync(path, JSON.stringify(DEFAULT_CATEGORIES, null, 2), 'utf-8');
    return DEFAULT_CATEGORIES;
  }
}

export function findCategory(id: string): ResearchCategory | null {
  const categories = ensureCategoriesFile();
  return categories.find((c) => c.id === id) ?? null;
}

export function ensureCategoryFolder(id: string): string {
  const root = getResearchCategoryRoot(id);
  mkdirSync(root, { recursive: true });
  return root;
}

export function guessTaskCategories(task: string, limit = 3): ResearchCategory[] {
  const lower = task.toLowerCase();
  const categories = ensureCategoriesFile();
  const scored = categories.map((c) => {
    let score = 0;
    if (lower.includes(c.id.replace(/-/g, ' '))) score += 5;
    for (const term of c.searchTerms) {
      if (lower.includes(term.toLowerCase())) score += 4;
    }
    for (const topic of c.topics) {
      if (lower.includes(topic.toLowerCase())) score += 2;
    }
    return { category: c, score };
  });
  return scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.category);
}
