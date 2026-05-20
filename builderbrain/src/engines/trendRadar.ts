/**
 * TrendRadar Engine — Production-Grade GitHub + Brave Trending Research
 * 
 * Scans GitHub trending repositories and supplements with Brave search data
 * to discover emerging tools, frameworks, and patterns. Supports daily scheduling
 * with rate-limit-aware API clients and exponential backoff retry logic.
 * 
 * @module trendRadar
 * @author Agent 1: TrendRadar Specialist
 * @since 2026-05-20
 */

/**
 * Type definitions for node-cron (optional dependency)
 */
interface CronJob {
  stop: () => void;
}

interface NodeCron {
  schedule: (expression: string, func: () => void) => CronJob;
}

/**
 * Configuration for TrendRadar scanning operations
 */
export interface TrendConfig {
  /** GitHub Personal Access Token (optional, increases rate limit from 10 to 30 req/min) */
  githubToken?: string;
  
  /** Brave Search API Key (optional, for supplementary web trend data) */
  braveApiKey?: string;
  
  /** Minimum stars threshold (default: 100) */
  minStars: number;
  
  /** Programming languages to filter (e.g., ['TypeScript', 'JavaScript', 'Python']) */
  languages: string[];
  
  /** Topic tags to filter (e.g., ['ai', 'mcp', 'agents']) */
  topics: string[];
  
  /** Time window in days for created/pushed activity (default: 7) */
  timeWindowDays: number;
  
  /** Maximum results to return per scan (default: 20) */
  maxResults: number;
  
  /** Enable Brave search supplement (default: false) */
  enableBraveSearch: boolean;
}

/**
 * A single trending repository result
 */
export interface TrendResult {
  /** Repository full name (owner/repo) */
  fullName: string;
  
  /** Repository description */
  description: string | null;
  
  /** Star count */
  stars: number;
  
  /** Primary programming language */
  language: string | null;
  
  /** Topic tags */
  topics: string[];
  
  /** Repository URL */
  url: string;
  
  /** Created date (ISO 8601) */
  createdAt: string;
  
  /** Last pushed date (ISO 8601) */
  pushedAt: string;
  
  /** Trend score (0-100, calculated based on velocity and engagement) */
  trendScore: number;
  
  /** Source of the trend data */
  source: 'github' | 'brave';
}

/**
 * Rate limiter state for API requests
 */
interface RateLimitState {
  /** Remaining requests in current window */
  remaining: number;
  
  /** Reset timestamp (Unix epoch seconds) */
  resetAt: number;
  
  /** Last check timestamp */
  lastCheck: number;
}

// In-memory rate limit tracking
const rateLimits: Map<string, RateLimitState> = new Map();

/**
 * Check and update rate limit state before making API calls
 * 
 * @param service - Service identifier ('github' or 'brave')
 * @param limit - Maximum requests per window
 * @returns true if request is allowed, false if rate limited
 */
function checkRateLimit(service: string, limit: number): boolean {
  const now = Date.now() / 1000; // Unix epoch seconds
  const state = rateLimits.get(service);
  
  if (!state) {
    rateLimits.set(service, { remaining: limit - 1, resetAt: now + 60, lastCheck: now });
    return true;
  }
  
  // Reset window if expired
  if (now >= state.resetAt) {
    state.remaining = limit - 1;
    state.resetAt = now + 60;
    state.lastCheck = now;
    return true;
  }
  
  // Check if we have requests remaining
  if (state.remaining > 0) {
    state.remaining--;
    state.lastCheck = now;
    return true;
  }
  
  return false;
}

/**
 * Sleep utility for exponential backoff
 * 
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry wrapper with exponential backoff
 * 
 * @param fn - Async function to retry
 * @param maxRetries - Maximum retry attempts (default: 3)
 * @param baseDelay - Base delay in ms (default: 1000)
 * @returns Result of the function or throws after max retries
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw new Error(`Max retries (${maxRetries}) exceeded: ${lastError.message}`);
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      console.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms: ${lastError.message}`);
      await sleep(delay);
    }
  }
  
  throw lastError!;
}

/**
 * Calculate trend score based on repository metrics
 * 
 * Formula: Weighted average of:
 * - Star velocity (stars per day since creation)
 * - Recent activity (days since last push, inverted)
 * - Topic relevance (bonus for matching configured topics)
 * 
 * @param stars - Star count
 * @param createdAt - Created date
 * @param pushedAt - Last pushed date
 * @param topics - Repository topics
 * @param configTopics - Configured filter topics
 * @returns Score from 0-100
 */
function calculateTrendScore(
  stars: number,
  createdAt: string,
  pushedAt: string,
  topics: string[],
  configTopics: string[]
): number {
  const now = new Date();
  const created = new Date(createdAt);
  const pushed = new Date(pushedAt);
  
  const ageInDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
  const daysSincePush = (now.getTime() - pushed.getTime()) / (1000 * 60 * 60 * 24);
  
  // Star velocity (stars per day)
  const starVelocity = ageInDays > 0 ? stars / ageInDays : stars;
  
  // Recent activity score (0-30 points, inverse of days since push)
  const activityScore = Math.max(0, 30 - daysSincePush);
  
  // Topic relevance score (0-20 points)
  const matchingTopics = topics.filter((t) => configTopics.some((ct) => t.toLowerCase().includes(ct.toLowerCase())));
  const topicScore = Math.min(20, matchingTopics.length * 5);
  
  // Star velocity score (0-50 points, logarithmic scale)
  const velocityScore = Math.min(50, Math.log10(starVelocity + 1) * 15);
  
  return Math.round(Math.min(100, activityScore + topicScore + velocityScore));
}

/**
 * Scan GitHub for trending repositories matching the config criteria
 * 
 * @param config - TrendConfig with filters and API credentials
 * @returns Array of TrendResult objects sorted by trend score (descending)
 */
export async function scanGitHubTrends(config: TrendConfig): Promise<TrendResult[]> {
  const results: TrendResult[] = [];
  
  // Calculate date threshold
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - config.timeWindowDays);
  const dateString = dateThreshold.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Build GitHub search query.
  // NOTE: GitHub search does NOT allow OR between qualifiers (language:, topic:).
  // A repo has exactly one primary language, so we filter by the first one only.
  const languageQuery = config.languages.length > 0
    ? `language:${config.languages[0]}`
    : '';
  const topicQuery = config.topics.length > 0
    ? config.topics.map((topic) => `topic:${topic}`).join(' ')
    : '';
  
  const query = [
    `stars:>${config.minStars}`,
    `pushed:>=${dateString}`,
    languageQuery,
    topicQuery,
  ]
    .filter(Boolean)
    .join(' ');
  
  const encodedQuery = encodeURIComponent(query);
  const url = `https://api.github.com/search/repositories?q=${encodedQuery}&sort=stars&order=desc&per_page=${config.maxResults}`;
  
  // Check rate limit
  const limit = config.githubToken ? 30 : 10;
  if (!checkRateLimit('github', limit)) {
    throw new Error('GitHub API rate limit exceeded. Please wait before retrying.');
  }
  
  // Make API request with retry logic
  const response = await retryWithBackoff(async () => {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'BuilderBrain-TrendRadar/2.0',
    };
    
    if (config.githubToken) {
      headers['Authorization'] = `Bearer ${config.githubToken}`;
    }
    
    const res = await fetch(url, { headers });
    
    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    }
    
    return res;
  });
  
  const data = await response.json() as {
    total_count: number;
    incomplete_results: boolean;
    items: Array<{
      full_name: string;
      description: string | null;
      stargazers_count: number;
      language: string | null;
      topics: string[];
      html_url: string;
      created_at: string;
      pushed_at: string;
    }>;
  };
  
  // Transform results
  for (const item of data.items) {
    const trendScore = calculateTrendScore(
      item.stargazers_count,
      item.created_at,
      item.pushed_at,
      item.topics,
      config.topics
    );
    
    results.push({
      fullName: item.full_name,
      description: item.description,
      stars: item.stargazers_count,
      language: item.language,
      topics: item.topics,
      url: item.html_url,
      createdAt: item.created_at,
      pushedAt: item.pushed_at,
      trendScore,
      source: 'github',
    });
  }
  
  return results.sort((a, b) => b.trendScore - a.trendScore);
}

/**
 * Scan Brave Search for supplementary trending data
 * 
 * @param config - TrendConfig with Brave API key
 * @returns Array of TrendResult objects from web sources
 */
export async function scanBraveTrends(config: TrendConfig): Promise<TrendResult[]> {
  if (!config.braveApiKey || !config.enableBraveSearch) {
    return [];
  }
  
  const results: TrendResult[] = [];
  
  // Build Brave search query
  const query = [
    'trending',
    ...config.topics,
    ...config.languages,
    'github',
  ].join(' ');
  
  const encodedQuery = encodeURIComponent(query);
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodedQuery}&count=10`;
  
  // Check rate limit (Brave allows more, but we're conservative)
  if (!checkRateLimit('brave', 20)) {
    console.warn('Brave API rate limit exceeded, skipping supplementary search');
    return [];
  }
  
  try {
    const response = await retryWithBackoff(async () => {
      const headers = {
        'Accept': 'application/json',
        'X-Subscription-Token': config.braveApiKey!,
      };
      
      const res = await fetch(url, { headers });
      
      if (!res.ok) {
        throw new Error(`Brave API error: ${res.status} ${res.statusText}`);
      }
      
      return res;
    });
    
    const data = await response.json() as {
      web?: {
        results: Array<{
          title: string;
          description: string;
          url: string;
        }>;
      };
    };
    
    // Parse GitHub repos from Brave results (basic heuristic)
    if (data.web?.results) {
      for (const item of data.web.results) {
        const githubMatch = item.url.match(/github\.com\/([^\/]+\/[^\/]+)/);
        if (githubMatch) {
          results.push({
            fullName: githubMatch[1],
            description: item.description,
            stars: 0, // Unknown from Brave
            language: null,
            topics: [],
            url: item.url,
            createdAt: new Date().toISOString(),
            pushedAt: new Date().toISOString(),
            trendScore: 50, // Default score for Brave results
            source: 'brave',
          });
        }
      }
    }
  } catch (error) {
    console.warn('Brave search failed, continuing with GitHub results only:', (error as Error).message);
  }
  
  return results;
}

/**
 * Main scan function that combines GitHub + Brave results
 * 
 * @param config - TrendConfig with all settings
 * @returns Combined and deduplicated array of TrendResult objects
 */
export async function scanTrends(config: TrendConfig): Promise<TrendResult[]> {
  const [githubResults, braveResults] = await Promise.all([
    scanGitHubTrends(config),
    scanBraveTrends(config),
  ]);
  
  // Deduplicate by fullName (prefer GitHub results)
  const resultsMap = new Map<string, TrendResult>();
  
  for (const result of githubResults) {
    resultsMap.set(result.fullName, result);
  }
  
  for (const result of braveResults) {
    if (!resultsMap.has(result.fullName)) {
      resultsMap.set(result.fullName, result);
    }
  }
  
  const combined = Array.from(resultsMap.values());
  return combined.sort((a, b) => b.trendScore - a.trendScore).slice(0, config.maxResults);
}

/**
 * Schedule recurring TrendRadar scans using cron syntax
 * 
 * Note: This function uses dynamic import for node-cron to make it an optional dependency.
 * Install with: npm install node-cron @types/node-cron
 * 
 * @param config - TrendConfig with scan settings
 * @param cronExpression - Cron expression (e.g., '0 9 * * *' for daily at 9am)
 * @param callback - Callback function invoked with scan results
 * @returns Promise that resolves to cleanup function to stop the scheduler
 * 
 * @example
 * ```typescript
 * const stop = await scheduleTrendRadar(
 *   config,
 *   '0 9 * * *', // Daily at 9am
 *   (results) => console.log('Found trends:', results)
 * );
 * 
 * // Later: stop the scheduler
 * stop();
 * ```
 */
export async function scheduleTrendRadar(
  config: TrendConfig,
  cronExpression: string,
  callback: (results: TrendResult[]) => void
): Promise<() => void> {
  let isRunning = false;
  
  const runScan = async () => {
    if (isRunning) {
      console.warn('TrendRadar scan already in progress, skipping this run');
      return;
    }
    
    isRunning = true;
    
    try {
      console.log('TrendRadar scan started at', new Date().toISOString());
      const results = await scanTrends(config);
      callback(results);
      console.log(`TrendRadar scan completed: ${results.length} trends found`);
    } catch (error) {
      console.error('TrendRadar scan failed:', (error as Error).message);
    } finally {
      isRunning = false;
    }
  };
  
  // Dynamic import of node-cron (makes it an optional dependency)
  try {
    // @ts-ignore: node-cron is an optional dependency
    const cron = await import('node-cron') as unknown as NodeCron;
    const cronJob = cron.schedule(cronExpression, runScan);
    console.log(`TrendRadar scheduler started with cron: ${cronExpression}`);
    
    // Return cleanup function
    return () => {
      cronJob.stop();
      console.log('TrendRadar scheduler stopped');
    };
  } catch (error) {
    throw new Error('Failed to load node-cron. Please install it: npm install node-cron @types/node-cron');
  }
}

/**
 * Create default TrendConfig with sensible defaults
 * 
 * @returns Default configuration
 */
export function createDefaultConfig(): TrendConfig {
  return {
    minStars: 100,
    languages: ['TypeScript', 'JavaScript'],
    topics: ['ai', 'mcp', 'agents', 'tools'],
    timeWindowDays: 7,
    maxResults: 20,
    enableBraveSearch: false,
  };
}
