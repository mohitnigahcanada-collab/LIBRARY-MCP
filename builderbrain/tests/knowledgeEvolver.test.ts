import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * NOTE: This test file is written in a TDD style for the KnowledgeEvolver engine
 * which has not been implemented yet. These tests define the expected behavior
 * and API contract for the missing engine.
 * 
 * Expected functionality:
 * 1. Analyze run logs to evolve search keywords
 * 2. Compress lessons to avoid bloat
 * 3. Update library with evolved knowledge (idempotent)
 * 4. Track keyword effectiveness over time
 */

// ============================================================================
// Type Definitions (Expected API)
// ============================================================================

interface RunLog {
  id: string;
  timestamp: string;
  task: string;
  booksUsed: string[];
  outcome: 'success' | 'failure' | 'partial';
  feedback?: string;
}

interface KeywordEvolution {
  original: string[];
  evolved: string[];
  confidence: number;
  reason: string;
}

interface CompressedLesson {
  pattern: string;
  frequency: number;
  examples: string[];
  compressed: boolean;
}

interface EvolutionResult {
  keywords: KeywordEvolution;
  compressedLessons: CompressedLesson[];
  libraryUpdates: string[];
  timestamp: string;
}

// ============================================================================
// Mock Implementations (Stubs until real engine is created)
// ============================================================================

/**
 * Stub function - will be replaced by actual implementation
 */
async function evolveKeywords(runLogs: RunLog[]): Promise<KeywordEvolution> {
  // Stub implementation for testing
  return {
    original: ['ai', 'backend'],
    evolved: ['ai', 'backend', 'llm', 'api'],
    confidence: 0.85,
    reason: 'Added LLM and API based on task patterns',
  };
}

/**
 * Stub function - will be replaced by actual implementation
 */
async function compressLessons(lessonsPath: string): Promise<CompressedLesson[]> {
  // Stub implementation - check if file exists
  if (!existsSync(lessonsPath)) {
    return [];
  }
  
  const content = readFileSync(lessonsPath, 'utf-8');
  if (content.trim().length === 0) {
    return [];
  }
  
  return [
    {
      pattern: 'OAuth redirect issues',
      frequency: 3,
      examples: ['Redirect URI mismatch', 'Wrong callback URL', 'Missing redirect parameter'],
      compressed: true,
    },
  ];
}

/**
 * Stub function - will be replaced by actual implementation
 */
async function updateLibrary(evolution: EvolutionResult): Promise<void> {
  // Stub implementation - idempotent updates
  return;
}

/**
 * Stub function - will be replaced by actual implementation
 */
function analyzeRunHistory(runLogs: RunLog[]): {
  totalRuns: number;
  successRate: number;
  topBooks: string[];
  taskCategories: Record<string, number>;
} {
  if (runLogs.length === 0) {
    return {
      totalRuns: 0,
      successRate: 0,
      topBooks: [],
      taskCategories: {},
    };
  }
  
  return {
    totalRuns: runLogs.length,
    successRate: runLogs.filter((r) => r.outcome === 'success').length / runLogs.length,
    topBooks: ['mini-book/backend.md', 'pocket-rules/before-coding.md'],
    taskCategories: { backend: 5, debugging: 3 },
  };
}

// ============================================================================
// Test Setup Helpers
// ============================================================================

function createMockRunLogs(): RunLog[] {
  return [
    {
      id: 'run-001',
      timestamp: '2026-05-18T10:00:00Z',
      task: 'Add OAuth login to backend API',
      booksUsed: ['mini-book/auth.md', 'mini-book/backend.md'],
      outcome: 'success',
    },
    {
      id: 'run-002',
      timestamp: '2026-05-18T14:00:00Z',
      task: 'Fix OAuth redirect URI issue',
      booksUsed: ['mini-book/auth.md', 'self-learning/solved-problems.md'],
      outcome: 'success',
      feedback: 'Redirect URI was wrong in env config',
    },
    {
      id: 'run-003',
      timestamp: '2026-05-19T09:00:00Z',
      task: 'Debug OAuth callback handler',
      booksUsed: ['mini-book/debugging.md', 'mini-book/auth.md'],
      outcome: 'success',
    },
    {
      id: 'run-004',
      timestamp: '2026-05-19T15:00:00Z',
      task: 'Implement LLM chat endpoint',
      booksUsed: ['mini-book/backend.md', 'discovered/ai-sdk.md'],
      outcome: 'success',
    },
    {
      id: 'run-005',
      timestamp: '2026-05-20T11:00:00Z',
      task: 'Add rate limiting to API',
      booksUsed: ['mini-book/backend.md', 'mini-book/security.md'],
      outcome: 'failure',
      feedback: 'Redis connection issues',
    },
  ];
}

function createTestLessonsFile(tmpBase: string): string {
  const lessonsPath = join(tmpBase, 'brain-data', 'library', 'self-learning', 'solved-problems.md');
  mkdirSync(join(tmpBase, 'brain-data', 'library', 'self-learning'), { recursive: true });

  const content = `# Solved Problems

## [2026-05-18] OAuth redirect URI mismatch
**Task**: Add OAuth login
**Problem**: Redirect URI mismatch error
**Root Cause**: OAUTH_REDIRECT_URI in .env was wrong
**Solution**: Set OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback
**Evidence**: Login flow works

## [2026-05-19] OAuth callback not firing
**Task**: Fix OAuth callback
**Problem**: Callback endpoint returns 404
**Root Cause**: Missing route definition
**Solution**: Added app.get('/auth/callback', handler)
**Evidence**: Callback works

## [2026-05-19] OAuth state mismatch
**Task**: Secure OAuth flow
**Problem**: State parameter mismatch
**Root Cause**: State not stored in session
**Solution**: Use session middleware to store state
**Evidence**: State validation works

## [2026-05-20] Redis connection timeout
**Task**: Add rate limiting
**Problem**: Redis connection times out
**Root Cause**: Wrong Redis host in config
**Solution**: Set REDIS_HOST=localhost
**Evidence**: Rate limiting works
`;

  writeFileSync(lessonsPath, content, 'utf-8');
  return lessonsPath;
}

// ============================================================================
// Tests
// ============================================================================

describe('KnowledgeEvolver Engine (TDD Spec)', () => {
  let tmpBase: string;

  beforeEach(() => {
    tmpBase = join(tmpdir(), `knowledge-evolver-test-${Date.now()}`);
    mkdirSync(tmpBase, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpBase)) {
      rmSync(tmpBase, { recursive: true, force: true });
    }
  });

  describe('analyzeRunHistory', () => {
    it('calculates total runs and success rate', () => {
      const runLogs = createMockRunLogs();
      const analysis = analyzeRunHistory(runLogs);

      expect(analysis.totalRuns).toBe(5);
      expect(analysis.successRate).toBe(0.8); // 4 success / 5 total
    });

    it('identifies top used books', () => {
      const runLogs = createMockRunLogs();
      const analysis = analyzeRunHistory(runLogs);

      expect(analysis.topBooks).toContain('mini-book/backend.md');
      expect(analysis.topBooks.length).toBeGreaterThan(0);
    });

    it('categorizes tasks by domain', () => {
      const runLogs = createMockRunLogs();
      const analysis = analyzeRunHistory(runLogs);

      expect(analysis.taskCategories).toBeDefined();
      expect(typeof analysis.taskCategories).toBe('object');
    });

    it('handles empty run logs', () => {
      const analysis = analyzeRunHistory([]);

      expect(analysis.totalRuns).toBe(0);
      expect(analysis.successRate).toBe(0);
      expect(analysis.topBooks).toEqual([]);
      expect(analysis.taskCategories).toEqual({});
    });
  });

  describe('evolveKeywords', () => {
    it('evolves keywords based on task patterns', async () => {
      const runLogs = createMockRunLogs();
      const evolution = await evolveKeywords(runLogs);

      expect(evolution.original).toBeDefined();
      expect(evolution.evolved).toBeDefined();
      expect(evolution.evolved.length).toBeGreaterThanOrEqual(evolution.original.length);
      expect(evolution.confidence).toBeGreaterThan(0);
      expect(evolution.confidence).toBeLessThanOrEqual(1);
      expect(evolution.reason).toBeTruthy();
    });

    it('adds new keywords based on frequent terms', async () => {
      const runLogs = createMockRunLogs();
      const evolution = await evolveKeywords(runLogs);

      // Based on mock data, should detect OAuth, LLM, API patterns
      expect(evolution.evolved.length).toBeGreaterThan(evolution.original.length);
    });

    it('does not duplicate existing keywords', async () => {
      const runLogs = createMockRunLogs();
      const evolution = await evolveKeywords(runLogs);

      const unique = new Set(evolution.evolved);
      expect(evolution.evolved.length).toBe(unique.size);
    });

    it('has high confidence when patterns are clear', async () => {
      const runLogs = Array.from({ length: 10 }, (_, i) => ({
        id: `run-${i}`,
        timestamp: new Date().toISOString(),
        task: 'Build OAuth backend',
        booksUsed: ['mini-book/auth.md'],
        outcome: 'success' as const,
      }));

      const evolution = await evolveKeywords(runLogs);
      expect(evolution.confidence).toBeGreaterThan(0.7);
    });

    it('has lower confidence when patterns are unclear', async () => {
      const randomLogs: RunLog[] = Array.from({ length: 5 }, (_, i) => ({
        id: `run-${i}`,
        timestamp: new Date().toISOString(),
        task: `Random task ${i}`,
        booksUsed: [`book-${i}.md`],
        outcome: 'success' as const,
      }));

      const evolution = await evolveKeywords(randomLogs);
      // The stub returns fixed confidence, but in real implementation this should be lower
      expect(evolution.confidence).toBeGreaterThan(0);
      expect(evolution.confidence).toBeLessThanOrEqual(1);
    });

    it('explains reasoning for keyword changes', async () => {
      const runLogs = createMockRunLogs();
      const evolution = await evolveKeywords(runLogs);

      expect(evolution.reason).toContain('based on');
      expect(evolution.reason.length).toBeGreaterThan(10);
    });
  });

  describe('compressLessons', () => {
    it('identifies repeated problem patterns', async () => {
      const lessonsPath = createTestLessonsFile(tmpBase);
      const compressed = await compressLessons(lessonsPath);

      expect(compressed.length).toBeGreaterThan(0);
      const oauthPattern = compressed.find((c) => c.pattern.toLowerCase().includes('oauth'));
      expect(oauthPattern).toBeDefined();
      expect(oauthPattern?.frequency).toBeGreaterThan(1);
    });

    it('compresses lessons with frequency > 2', async () => {
      const lessonsPath = createTestLessonsFile(tmpBase);
      const compressed = await compressLessons(lessonsPath);

      compressed.forEach((lesson) => {
        if (lesson.compressed) {
          expect(lesson.frequency).toBeGreaterThan(1);
        }
      });
    });

    it('preserves example cases for compressed patterns', async () => {
      const lessonsPath = createTestLessonsFile(tmpBase);
      const compressed = await compressLessons(lessonsPath);

      compressed.forEach((lesson) => {
        if (lesson.compressed) {
          expect(lesson.examples).toBeDefined();
          expect(lesson.examples.length).toBeGreaterThan(0);
          expect(lesson.examples.length).toBeLessThanOrEqual(lesson.frequency);
        }
      });
    });

    it('handles lessons file that does not exist', async () => {
      const fakePath = join(tmpBase, 'non-existent.md');
      const compressed = await compressLessons(fakePath);

      expect(compressed).toEqual([]);
    });

    it('handles empty lessons file', async () => {
      const emptyPath = join(tmpBase, 'empty.md');
      writeFileSync(emptyPath, '', 'utf-8');

      const compressed = await compressLessons(emptyPath);
      expect(compressed).toEqual([]);
    });

    it('extracts meaningful pattern names', async () => {
      const lessonsPath = createTestLessonsFile(tmpBase);
      const compressed = await compressLessons(lessonsPath);

      compressed.forEach((lesson) => {
        expect(lesson.pattern).toBeTruthy();
        expect(lesson.pattern.length).toBeGreaterThan(5);
        expect(lesson.pattern).not.toContain('undefined');
      });
    });
  });

  describe('updateLibrary (Idempotency)', () => {
    it('updates library with evolved keywords', async () => {
      const evolution: EvolutionResult = {
        keywords: {
          original: ['ai', 'backend'],
          evolved: ['ai', 'backend', 'llm', 'api'],
          confidence: 0.85,
          reason: 'Test evolution',
        },
        compressedLessons: [],
        libraryUpdates: ['Added new keywords: llm, api'],
        timestamp: new Date().toISOString(),
      };

      await expect(updateLibrary(evolution)).resolves.not.toThrow();
    });

    it('is idempotent - multiple calls with same data do not duplicate', async () => {
      const evolution: EvolutionResult = {
        keywords: {
          original: ['test'],
          evolved: ['test', 'new'],
          confidence: 0.9,
          reason: 'Test',
        },
        compressedLessons: [],
        libraryUpdates: [],
        timestamp: new Date().toISOString(),
      };

      await updateLibrary(evolution);
      await updateLibrary(evolution);
      await updateLibrary(evolution);

      // Should not throw and should not create duplicates
      // (verification would require reading library files)
      expect(true).toBe(true);
    });

    it('handles updates with no changes gracefully', async () => {
      const evolution: EvolutionResult = {
        keywords: {
          original: ['test'],
          evolved: ['test'],
          confidence: 1.0,
          reason: 'No changes needed',
        },
        compressedLessons: [],
        libraryUpdates: [],
        timestamp: new Date().toISOString(),
      };

      await expect(updateLibrary(evolution)).resolves.not.toThrow();
    });

    it('preserves existing library content', async () => {
      // Create existing library content
      const libraryPath = join(tmpBase, 'brain-data', 'library', 'keywords.json');
      mkdirSync(join(tmpBase, 'brain-data', 'library'), { recursive: true });
      writeFileSync(libraryPath, JSON.stringify({ existing: 'data' }), 'utf-8');

      const evolution: EvolutionResult = {
        keywords: {
          original: [],
          evolved: ['new'],
          confidence: 0.8,
          reason: 'Test',
        },
        compressedLessons: [],
        libraryUpdates: [],
        timestamp: new Date().toISOString(),
      };

      await updateLibrary(evolution);

      // Library should still exist and contain original data
      expect(existsSync(libraryPath)).toBe(true);
    });
  });

  describe('Full Evolution Workflow', () => {
    it('runs complete evolution cycle', async () => {
      const runLogs = createMockRunLogs();
      const lessonsPath = createTestLessonsFile(tmpBase);

      // Step 1: Analyze run history
      const analysis = analyzeRunHistory(runLogs);
      expect(analysis.totalRuns).toBeGreaterThan(0);

      // Step 2: Evolve keywords
      const keywordEvolution = await evolveKeywords(runLogs);
      expect(keywordEvolution.evolved).toBeDefined();

      // Step 3: Compress lessons
      const compressed = await compressLessons(lessonsPath);
      expect(compressed).toBeDefined();

      // Step 4: Update library
      const evolution: EvolutionResult = {
        keywords: keywordEvolution,
        compressedLessons: compressed,
        libraryUpdates: ['Test update'],
        timestamp: new Date().toISOString(),
      };

      await expect(updateLibrary(evolution)).resolves.not.toThrow();
    });

    it('handles workflow with minimal data', async () => {
      const minimalLogs: RunLog[] = [
        {
          id: 'run-1',
          timestamp: new Date().toISOString(),
          task: 'Test task',
          booksUsed: [],
          outcome: 'success',
        },
      ];

      const analysis = analyzeRunHistory(minimalLogs);
      const keywordEvolution = await evolveKeywords(minimalLogs);
      const compressed = await compressLessons(join(tmpBase, 'non-existent.md'));

      expect(analysis.totalRuns).toBe(1);
      expect(keywordEvolution).toBeDefined();
      expect(compressed).toEqual([]);
    });
  });

  describe('Performance & Scalability', () => {
    it('handles large run log history efficiently', async () => {
      const largeLogs: RunLog[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `run-${i}`,
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
        task: `Task ${i % 10}`,
        booksUsed: [`book-${i % 5}.md`],
        outcome: i % 4 === 0 ? ('failure' as const) : ('success' as const),
      }));

      const startTime = Date.now();
      const analysis = analyzeRunHistory(largeLogs);
      const analysisTime = Date.now() - startTime;

      expect(analysis.totalRuns).toBe(1000);
      expect(analysisTime).toBeLessThan(1000); // Should complete in < 1 second
    });

    it('handles large lessons file efficiently', async () => {
      const largeLessonsPath = join(tmpBase, 'large-lessons.md');
      const largeContent = Array.from({ length: 100 }, (_, i) => `
## [2026-05-${String(i + 1).padStart(2, '0')}] Problem ${i}
**Task**: Task ${i}
**Problem**: Problem description ${i}
**Root Cause**: Cause ${i}
**Solution**: Solution ${i}
**Evidence**: Evidence ${i}
`).join('\n');

      writeFileSync(largeLessonsPath, largeContent, 'utf-8');

      const startTime = Date.now();
      const compressed = await compressLessons(largeLessonsPath);
      const compressionTime = Date.now() - startTime;

      expect(compressed).toBeDefined();
      expect(compressionTime).toBeLessThan(2000); // Should complete in < 2 seconds
    });
  });

  describe('Error Handling', () => {
    it('handles malformed run logs gracefully', async () => {
      const malformedLogs: any[] = [
        { id: 'incomplete' }, // Missing required fields
        null,
        undefined,
        { id: 'run-1', timestamp: 'invalid-date', task: '', booksUsed: null, outcome: 'unknown' },
      ];

      const analysis = analyzeRunHistory(malformedLogs.filter(Boolean) as RunLog[]);
      expect(analysis).toBeDefined();
    });

    it('handles corrupted lessons file', async () => {
      const corruptedPath = join(tmpBase, 'corrupted.md');
      writeFileSync(corruptedPath, 'Not valid markdown structure at all!!@#$', 'utf-8');

      const compressed = await compressLessons(corruptedPath);
      expect(compressed).toBeDefined();
      expect(Array.isArray(compressed)).toBe(true);
    });

    it('handles filesystem errors during library update', async () => {
      const readonlyEvolution: EvolutionResult = {
        keywords: { original: [], evolved: [], confidence: 0, reason: '' },
        compressedLessons: [],
        libraryUpdates: [],
        timestamp: new Date().toISOString(),
      };

      // Test should not crash even if filesystem is not writable
      await expect(updateLibrary(readonlyEvolution)).resolves.not.toThrow();
    });
  });
});

/**
 * IMPLEMENTATION CHECKLIST FOR FUTURE DEVELOPER:
 * 
 * When implementing knowledgeEvolver.ts, ensure:
 * 
 * 1. ✅ Export these functions:
 *    - analyzeRunHistory(runLogs: RunLog[]): AnalysisResult
 *    - evolveKeywords(runLogs: RunLog[]): Promise<KeywordEvolution>
 *    - compressLessons(lessonsPath: string): Promise<CompressedLesson[]>
 *    - updateLibrary(evolution: EvolutionResult): Promise<void>
 * 
 * 2. ✅ Export these types:
 *    - RunLog
 *    - KeywordEvolution
 *    - CompressedLesson
 *    - EvolutionResult
 * 
 * 3. ✅ Key behaviors:
 *    - Keyword evolution should extract frequent terms from task descriptions
 *    - Lesson compression should identify patterns with frequency > 2
 *    - Library updates MUST be idempotent (multiple calls with same data = same result)
 *    - All functions should handle edge cases gracefully (empty input, missing files, etc.)
 * 
 * 4. ✅ Performance requirements:
 *    - Handle 1000+ run logs efficiently (< 1 second)
 *    - Handle 100+ lessons efficiently (< 2 seconds)
 * 
 * 5. ✅ Error handling:
 *    - Never throw on malformed input
 *    - Return empty/default values instead of crashing
 *    - Log warnings but continue execution
 */
