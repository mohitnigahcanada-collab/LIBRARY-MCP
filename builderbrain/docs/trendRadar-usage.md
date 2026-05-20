# TrendRadar Engine — Usage Examples

## Quick Start

```typescript
import { scanTrends, createDefaultConfig, scheduleTrendRadar } from './engines/trendRadar.js';

// 1. One-time scan with default config
const config = createDefaultConfig();
const trends = await scanTrends(config);

console.log(`Found ${trends.length} trending repos:`);
trends.forEach((trend) => {
  console.log(`- ${trend.fullName} (${trend.stars}⭐, score: ${trend.trendScore})`);
});
```

## Advanced Configuration

```typescript
import { scanTrends, TrendConfig } from './engines/trendRadar.js';

const config: TrendConfig = {
  githubToken: process.env.GITHUB_TOKEN, // Optional, increases rate limit to 30 req/min
  braveApiKey: process.env.BRAVE_API_KEY, // Optional, for supplementary data
  minStars: 200,
  languages: ['TypeScript', 'Python', 'Rust'],
  topics: ['ai', 'agents', 'mcp', 'llm'],
  timeWindowDays: 14, // Last 2 weeks
  maxResults: 30,
  enableBraveSearch: true,
};

const trends = await scanTrends(config);

// Filter by trend score
const hotTrends = trends.filter((t) => t.trendScore > 70);
console.log('Hot trends:', hotTrends);
```

## Scheduled Daily Scans

```typescript
import { scheduleTrendRadar, createDefaultConfig } from './engines/trendRadar.js';

const config = createDefaultConfig();
config.githubToken = process.env.GITHUB_TOKEN;

// Run daily at 9:00 AM
const stopScheduler = scheduleTrendRadar(
  config,
  '0 9 * * *',
  (results) => {
    console.log(`Daily TrendRadar scan complete at ${new Date().toISOString()}`);
    
    // Save to database, send notifications, etc.
    results.slice(0, 5).forEach((trend) => {
      console.log(`🔥 ${trend.fullName} — ${trend.trendScore}/100`);
      console.log(`   ${trend.description}`);
      console.log(`   ${trend.url}\n`);
    });
  }
);

// Stop the scheduler when needed
// stopScheduler();
```

## Cron Schedule Examples

```typescript
// Every day at 9:00 AM
'0 9 * * *'

// Every 6 hours
'0 */6 * * *'

// Every Monday at 8:00 AM
'0 8 * * 1'

// Every day at 9:00 AM and 5:00 PM
'0 9,17 * * *'
```

## Error Handling

```typescript
import { scanTrends, createDefaultConfig } from './engines/trendRadar.js';

try {
  const trends = await scanTrends(createDefaultConfig());
  console.log('Success:', trends);
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('rate limit')) {
      console.error('Rate limited — wait 60 seconds and retry');
    } else if (error.message.includes('Max retries')) {
      console.error('GitHub API unavailable — try again later');
    } else {
      console.error('Scan failed:', error.message);
    }
  }
}
```

## Integration with BuilderBrain

```typescript
import { scanTrends, createDefaultConfig } from './engines/trendRadar.js';
import { classifyDomains } from './engines/classifier.js';

const config = createDefaultConfig();
config.topics = ['ai', 'agents', 'mcp'];

const trends = await scanTrends(config);

// Enrich with BuilderBrain domain classification
const enrichedTrends = trends.map((trend) => {
  const domains = classifyDomains(trend.description || '');
  return { ...trend, domains };
});

// Filter for AI-agent-related repos
const aiAgentTrends = enrichedTrends.filter((t) => 
  t.domains.includes('ai-agents')
);

console.log('AI Agent trends:', aiAgentTrends);
```

## Testing Locally (No API Keys)

```typescript
// Mock results for testing without API keys
const mockTrends = [
  {
    fullName: 'example/repo',
    description: 'Example trending repo',
    stars: 500,
    language: 'TypeScript',
    topics: ['ai', 'tools'],
    url: 'https://github.com/example/repo',
    createdAt: new Date().toISOString(),
    pushedAt: new Date().toISOString(),
    trendScore: 85,
    source: 'github' as const,
  },
];

// Use in development
const trends = process.env.NODE_ENV === 'production' 
  ? await scanTrends(config) 
  : mockTrends;
```

## Best Practices

1. **Use GitHub Token**: Always set `githubToken` in production to increase rate limit from 10 to 30 req/min
2. **Filter Strategically**: Narrow `languages` and `topics` to reduce noise
3. **Monitor Rate Limits**: Built-in rate limiting prevents API abuse, but monitor logs
4. **Handle Errors**: Wrap `scanTrends()` in try/catch for network failures
5. **Cache Results**: Store results in a database to avoid redundant scans
6. **Adjust Scoring**: Modify `calculateTrendScore()` logic if default scoring doesn't fit your needs

## Environment Variables

```bash
# .env file
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxx
BRAVE_API_KEY=BSAxxxxxxxxxxxxxxxxxxxxx
```

## Installation

```bash
npm install node-cron
npm install --save-dev @types/node-cron
```
