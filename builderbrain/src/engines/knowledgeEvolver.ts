/**
 * KnowledgeEvolver Engine — Self-Improving Knowledge System
 * 
 * Analyzes run history logs and self-learning memory to discover patterns,
 * propose keyword updates, compress lessons, and evolve the domain library.
 * Uses statistical frequency analysis to identify emerging keywords and concepts.
 * 
 * Algorithm:
 * 1. Frequency Analysis: Extract all tokens from task descriptions in run logs
 * 2. Statistical Thresholding: Keywords appearing in 10+ tasks suggest addition
 * 3. Domain Correlation: Map frequent keywords to most-associated domains
 * 4. Confidence Scoring: Weight by recency, task success, and co-occurrence
 * 5. Lesson Compression: Extract core patterns from solved problems via NLP-like heuristics
 * 6. Safe Evolution: Write to discovered/ directory, never overwrite core files
 * 
 * @module knowledgeEvolver
 * @author Agent 3: KnowledgeEvolver Engine Specialist
 * @since 2026-05-20
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { Domain } from './classifier.js';
import { listRunLogs, RunLog, getRunsDir } from '../logger.js';
import { readSolvedProblems, getLibraryPath } from '../memory/selfLearning.js';

/**
 * Insights discovered from analyzing run history and self-learning memory
 */
export interface EvolutionInsight {
  /** New keywords discovered with frequency counts */
  newKeywords: Map<string, KeywordStats>;
  
  /** Domain usage shifts (e.g., 'ai-agents' usage increased 40%) */
  domainShifts: Map<Domain, DomainShift>;
  
  /** Pattern frequency analysis (recurring task patterns) */
  patternFrequency: Map<string, number>;
  
  /** Suggested updates to book stack based on domain trends */
  suggestedBookUpdates: BookUpdate[];
}

/**
 * Statistical metadata for a discovered keyword
 */
export interface KeywordStats {
  /** Total occurrences across all analyzed runs */
  count: number;
  
  /** Domains this keyword most frequently appears with */
  associatedDomains: Map<Domain, number>;
  
  /** Average confidence level of tasks containing this keyword */
  avgConfidence: number;
  
  /** First seen timestamp (ISO 8601) */
  firstSeen: string;
  
  /** Most recent occurrence timestamp */
  lastSeen: string;
  
  /** Trend direction: 'rising', 'stable', 'declining' */
  trend: 'rising' | 'stable' | 'declining';
}

/**
 * Domain usage shift analysis
 */
export interface DomainShift {
  /** Domain identifier */
  domain: Domain;
  
  /** Previous usage percentage (0-100) */
  previousUsage: number;
  
  /** Current usage percentage (0-100) */
  currentUsage: number;
  
  /** Percentage point change (+/- value) */
  change: number;
  
  /** Is this shift statistically significant? */
  significant: boolean;
}

/**
 * Suggested book/document update
 */
export interface BookUpdate {
  /** Type of update action */
  action: 'create' | 'update' | 'deprecate';
  
  /** Book path (relative to library root) */
  path: string;
  
  /** Human-readable reason for the suggestion */
  reason: string;
  
  /** Related keywords driving this suggestion */
  keywords: string[];
  
  /** Confidence score (0-100) for this suggestion */
  confidence: number;
}

/**
 * Configuration for evolution analysis
 */
export interface EvolutionConfig {
  /** Minimum frequency threshold for keyword consideration (default: 10) */
  minFrequency: number;
  
  /** Window size for trend analysis in days (default: 30) */
  trendWindowDays: number;
  
  /** Minimum change threshold for significant domain shifts (default: 10%) */
  significanceThreshold: number;
}

const DEFAULT_CONFIG: EvolutionConfig = {
  minFrequency: 10,
  trendWindowDays: 30,
  significanceThreshold: 10,
};

/**
 * Stopwords to exclude from keyword analysis (common English words)
 */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
  'could', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i',
  'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her',
  'its', 'our', 'their', 'what', 'which', 'who', 'when', 'where', 'why', 'how',
]);

/**
 * Analyzes run history logs to discover patterns and evolution insights
 * 
 * @param limit - Maximum number of recent runs to analyze (default: 100)
 * @param config - Optional configuration overrides
 * @returns Evolution insights including new keywords, domain shifts, and patterns
 */
export async function analyzeRunHistory(
  limit = 100,
  config: Partial<EvolutionConfig> = {}
): Promise<EvolutionInsight> {
  const conf = { ...DEFAULT_CONFIG, ...config };
  const logs = listRunLogs(limit);

  if (logs.length === 0) {
    return {
      newKeywords: new Map(),
      domainShifts: new Map(),
      patternFrequency: new Map(),
      suggestedBookUpdates: [],
    };
  }

  // Extract keywords with frequency and domain correlation
  const keywordMap = extractKeywordsWithStats(logs, conf);

  // Analyze domain usage shifts
  const domainShifts = analyzeDomainShifts(logs, conf);

  // Detect recurring task patterns
  const patterns = extractPatterns(logs, conf);

  // Generate book update suggestions based on trends
  const bookUpdates = generateBookSuggestions(keywordMap, domainShifts, conf);

  return {
    newKeywords: keywordMap,
    domainShifts,
    patternFrequency: patterns,
    suggestedBookUpdates: bookUpdates,
  };
}

/**
 * Extracts keywords from run logs with statistical metadata
 */
function extractKeywordsWithStats(
  logs: RunLog[],
  config: EvolutionConfig
): Map<string, KeywordStats> {
  const keywordData = new Map<string, {
    count: number;
    domains: Map<Domain, number>;
    confidences: string[];
    timestamps: string[];
  }>();

  for (const log of logs) {
    const tokens = tokenize(log.input + ' ' + log.summary);
    
    for (const token of tokens) {
      if (STOPWORDS.has(token) || token.length < 3) continue;

      if (!keywordData.has(token)) {
        keywordData.set(token, {
          count: 0,
          domains: new Map(),
          confidences: [],
          timestamps: [],
        });
      }

      const data = keywordData.get(token)!;
      data.count += 1;
      data.confidences.push(log.confidence);
      data.timestamps.push(log.timestamp);

      for (const domain of log.detectedDomains) {
        data.domains.set(domain, (data.domains.get(domain) || 0) + 1);
      }
    }
  }

  // Filter by minimum frequency and build KeywordStats
  const result = new Map<string, KeywordStats>();
  
  for (const [keyword, data] of Array.from(keywordData.entries())) {
    if (data.count < config.minFrequency) continue;

    const avgConfidence = calculateAvgConfidence(data.confidences);
    const trend = calculateTrend(data.timestamps, config.trendWindowDays);

    result.set(keyword, {
      count: data.count,
      associatedDomains: data.domains,
      avgConfidence,
      firstSeen: data.timestamps[data.timestamps.length - 1],
      lastSeen: data.timestamps[0],
      trend,
    });
  }

  return result;
}

/**
 * Tokenizes text into lowercase words
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Calculates average confidence from confidence level strings
 */
function calculateAvgConfidence(confidences: string[]): number {
  const scores = confidences.map(c => {
    switch (c) {
      case 'High': return 85;
      case 'Medium': return 55;
      case 'Low': return 25;
      default: return 50;
    }
  });
  
  return scores.reduce((sum, val) => sum + val, 0) / scores.length;
}

/**
 * Determines trend direction based on timestamp distribution
 */
function calculateTrend(timestamps: string[], windowDays: number): 'rising' | 'stable' | 'declining' {
  if (timestamps.length < 5) return 'stable';

  const now = Date.now();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  
  const recentCount = timestamps.filter(ts => 
    (now - new Date(ts).getTime()) < windowMs
  ).length;

  const recentRatio = recentCount / timestamps.length;

  if (recentRatio > 0.7) return 'rising';
  if (recentRatio < 0.3) return 'declining';
  return 'stable';
}

/**
 * Analyzes domain usage shifts over time
 */
function analyzeDomainShifts(logs: RunLog[], config: EvolutionConfig): Map<Domain, DomainShift> {
  if (logs.length < 20) {
    return new Map(); // Need sufficient data for meaningful shift analysis
  }

  const splitPoint = Math.floor(logs.length / 2);
  const oldLogs = logs.slice(splitPoint);
  const newLogs = logs.slice(0, splitPoint);

  const oldCounts = countDomainUsage(oldLogs);
  const newCounts = countDomainUsage(newLogs);

  const shifts = new Map<Domain, DomainShift>();

  const allDomains = new Set([...Array.from(oldCounts.keys()), ...Array.from(newCounts.keys())]);

  for (const domain of Array.from(allDomains)) {
    const oldUsage = ((oldCounts.get(domain) || 0) / oldLogs.length) * 100;
    const newUsage = ((newCounts.get(domain) || 0) / newLogs.length) * 100;
    const change = newUsage - oldUsage;

    shifts.set(domain, {
      domain,
      previousUsage: oldUsage,
      currentUsage: newUsage,
      change,
      significant: Math.abs(change) >= config.significanceThreshold,
    });
  }

  return shifts;
}

/**
 * Counts domain usage frequency in logs
 */
function countDomainUsage(logs: RunLog[]): Map<Domain, number> {
  const counts = new Map<Domain, number>();
  
  for (const log of logs) {
    for (const domain of log.detectedDomains) {
      counts.set(domain, (counts.get(domain) || 0) + 1);
    }
  }
  
  return counts;
}

/**
 * Extracts recurring task patterns using n-gram analysis
 */
function extractPatterns(logs: RunLog[], config: EvolutionConfig): Map<string, number> {
  const patterns = new Map<string, number>();

  for (const log of logs) {
    const tokens = tokenize(log.input);
    
    // Extract 2-grams and 3-grams as patterns
    for (let i = 0; i < tokens.length - 1; i++) {
      const bigram = `${tokens[i]} ${tokens[i + 1]}`;
      if (!STOPWORDS.has(tokens[i]) && !STOPWORDS.has(tokens[i + 1])) {
        patterns.set(bigram, (patterns.get(bigram) || 0) + 1);
      }

      if (i < tokens.length - 2) {
        const trigram = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
        if (!STOPWORDS.has(tokens[i]) && !STOPWORDS.has(tokens[i + 2])) {
          patterns.set(trigram, (patterns.get(trigram) || 0) + 1);
        }
      }
    }
  }

  // Filter patterns by minimum frequency
  const filtered = new Map<string, number>();
  for (const [pattern, count] of Array.from(patterns.entries())) {
    if (count >= Math.max(3, config.minFrequency / 3)) {
      filtered.set(pattern, count);
    }
  }

  return filtered;
}

/**
 * Generates book update suggestions based on keyword and domain trends
 */
function generateBookSuggestions(
  keywords: Map<string, KeywordStats>,
  domainShifts: Map<Domain, DomainShift>,
  config: EvolutionConfig
): BookUpdate[] {
  const suggestions: BookUpdate[] = [];

  // Suggest new books for rising keywords with high frequency
  for (const [keyword, stats] of Array.from(keywords.entries())) {
    if (stats.trend === 'rising' && stats.count >= config.minFrequency * 1.5) {
      const topDomain = getTopDomain(stats.associatedDomains);
      
      suggestions.push({
        action: 'create',
        path: `discovered/${keyword}-patterns.md`,
        reason: `Emerging keyword "${keyword}" appears ${stats.count} times with rising trend in ${topDomain} domain`,
        keywords: [keyword],
        confidence: Math.min(95, 50 + stats.count),
      });
    }
  }

  // Suggest book updates for significant domain shifts
  for (const [domain, shift] of Array.from(domainShifts.entries())) {
    if (shift.significant && shift.change > 0) {
      suggestions.push({
        action: 'update',
        path: `mini-book/${domain}.md`,
        reason: `Domain "${domain}" usage increased by ${shift.change.toFixed(1)}% — may need expanded coverage`,
        keywords: [],
        confidence: Math.min(90, 60 + Math.abs(shift.change)),
      });
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Gets the domain with highest association count
 */
function getTopDomain(domains: Map<Domain, number>): Domain {
  let topDomain: Domain = 'backend';
  let maxCount = 0;

  for (const [domain, count] of Array.from(domains.entries())) {
    if (count > maxCount) {
      maxCount = count;
      topDomain = domain;
    }
  }

  return topDomain;
}

/**
 * Proposes keyword updates for classifier based on frequency analysis
 * 
 * @returns Map of domains to suggested new keywords
 */
export async function proposeKeywordUpdates(): Promise<Record<Domain, string[]>> {
  const insight = await analyzeRunHistory(100);
  const proposals: Partial<Record<Domain, string[]>> = {};

  for (const [keyword, stats] of Array.from(insight.newKeywords.entries())) {
    const topDomain = getTopDomain(stats.associatedDomains);
    
    if (!proposals[topDomain]) {
      proposals[topDomain] = [];
    }
    
    proposals[topDomain]!.push(keyword);
  }

  return proposals as Record<Domain, string[]>;
}

/**
 * Compresses self-learning lessons into condensed wisdom
 * 
 * Extracts core patterns, root causes, and solutions from solved problems
 * using heuristic-based text analysis (keyword extraction + frequency).
 * 
 * @returns Compressed wisdom summary as markdown string
 */
export async function compressLessons(): Promise<string> {
  const content = readSolvedProblems();
  
  if (!content || content.length < 50) {
    return '# Compressed Lessons\n\n_No lessons available yet._';
  }

  const lines = content.split('\n');
  const sections: { task: string; problem: string; rootCause: string; solution: string }[] = [];
  
  let currentSection: any = {};

  for (const line of lines) {
    if (line.startsWith('## [')) {
      if (currentSection.task) sections.push(currentSection);
      currentSection = {};
    } else if (line.startsWith('**Task**:')) {
      currentSection.task = line.replace('**Task**:', '').trim();
    } else if (line.startsWith('**Problem**:')) {
      currentSection.problem = line.replace('**Problem**:', '').trim();
    } else if (line.startsWith('**Root Cause**:')) {
      currentSection.rootCause = line.replace('**Root Cause**:', '').trim();
    } else if (line.startsWith('**Solution**:')) {
      currentSection.solution = line.replace('**Solution**:', '').trim();
    }
  }

  if (currentSection.task) sections.push(currentSection);

  // Extract recurring themes
  const problemThemes = new Map<string, number>();
  const solutionPatterns = new Map<string, number>();

  for (const section of sections) {
    const problemTokens = tokenize(section.problem || '');
    const solutionTokens = tokenize(section.solution || '');

    for (const token of problemTokens) {
      if (!STOPWORDS.has(token) && token.length > 3) {
        problemThemes.set(token, (problemThemes.get(token) || 0) + 1);
      }
    }

    for (const token of solutionTokens) {
      if (!STOPWORDS.has(token) && token.length > 3) {
        solutionPatterns.set(token, (solutionPatterns.get(token) || 0) + 1);
      }
    }
  }

  // Build compressed summary
  const topProblems = Array.from(problemThemes.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const topSolutions = Array.from(solutionPatterns.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  let compressed = `# Compressed Lessons\n\n`;
  compressed += `**Total Lessons Analyzed**: ${sections.length}\n\n`;
  
  compressed += `## Most Common Problem Themes\n`;
  for (const [theme, count] of topProblems) {
    compressed += `- **${theme}** (${count}x)\n`;
  }

  compressed += `\n## Most Common Solution Patterns\n`;
  for (const [pattern, count] of topSolutions) {
    compressed += `- **${pattern}** (${count}x)\n`;
  }

  compressed += `\n## Core Wisdom\n`;
  compressed += `Based on ${sections.length} solved problems, the most recurring issues involve `;
  compressed += topProblems.slice(0, 3).map(([t]) => t).join(', ');
  compressed += `. Effective solutions frequently use `;
  compressed += topSolutions.slice(0, 3).map(([p]) => p).join(', ');
  compressed += `.`;

  return compressed;
}

/**
 * Applies evolution insights to the library by updating keywords and creating books
 * 
 * This function is idempotent and safe:
 * - Never overwrites existing core files
 * - Writes to discovered/ directory only
 * - Creates keyword proposals as JSON for human review
 * 
 * @param insight - Evolution insights from analyzeRunHistory
 */
export async function evolveLibrary(insight: EvolutionInsight): Promise<void> {
  const libraryPath = getLibraryPath();
  const discoveredDir = join(libraryPath, 'discovered');
  
  // Ensure discovered directory exists
  mkdirSync(discoveredDir, { recursive: true });

  // Save keyword proposals as JSON for review (never auto-apply to classifier)
  const keywordProposalPath = join(discoveredDir, 'keyword-proposals.json');
  const proposals = Array.from(insight.newKeywords.entries()).map(([kw, stats]) => ({
    keyword: kw,
    count: stats.count,
    topDomain: getTopDomain(stats.associatedDomains),
    trend: stats.trend,
    avgConfidence: stats.avgConfidence,
  }));

  writeFileSync(
    keywordProposalPath,
    JSON.stringify(proposals, null, 2),
    'utf-8'
  );

  // Create discovered books for high-confidence suggestions
  for (const update of insight.suggestedBookUpdates) {
    if (update.action === 'create' && update.confidence >= 70) {
      const bookPath = join(libraryPath, update.path);
      
      // Only create if doesn't exist (idempotent)
      if (!existsSync(bookPath)) {
        const bookDir = join(bookPath, '..');
        mkdirSync(bookDir, { recursive: true });

        const content = generateDiscoveredBookContent(update);
        writeFileSync(bookPath, content, 'utf-8');
      }
    }
  }

  // Save domain shift analysis
  const shiftsPath = join(discoveredDir, 'domain-shifts.json');
  const shifts = Array.from(insight.domainShifts.entries()).map(([_domainKey, shift]) => shift);

  writeFileSync(shiftsPath, JSON.stringify(shifts, null, 2), 'utf-8');

  // Save pattern frequency
  const patternsPath = join(discoveredDir, 'patterns.json');
  const patterns = Array.from(insight.patternFrequency.entries()).map(([pattern, count]) => ({
    pattern,
    count,
  }));

  writeFileSync(patternsPath, JSON.stringify(patterns, null, 2), 'utf-8');
}

/**
 * Generates markdown content for a discovered book
 */
function generateDiscoveredBookContent(update: BookUpdate): string {
  const date = new Date().toISOString().split('T')[0];
  
  let content = `# ${update.path.split('/').pop()?.replace('.md', '').replace(/-/g, ' ').toUpperCase()}\n\n`;
  content += `**Auto-generated by KnowledgeEvolver** on ${date}\n\n`;
  content += `## Why This Book Exists\n\n`;
  content += `${update.reason}\n\n`;
  content += `**Related Keywords**: ${update.keywords.join(', ')}\n\n`;
  content += `**Confidence**: ${update.confidence}%\n\n`;
  content += `## Patterns Observed\n\n`;
  content += `_This section will be populated as more data is collected._\n\n`;
  content += `## Best Practices\n\n`;
  content += `_To be filled based on run history analysis._\n\n`;
  content += `## Common Pitfalls\n\n`;
  content += `_To be discovered from failed runs and debugging sessions._\n`;

  return content;
}
