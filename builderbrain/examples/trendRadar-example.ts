/**
 * TrendRadar Engine — Quick Example
 * 
 * This is a standalone example showing how to use the TrendRadar engine.
 * Copy this code to test the engine locally.
 */

import { scanTrends, scheduleTrendRadar, createDefaultConfig, type TrendConfig } from './engines/trendRadar.js';

// ============================================================================
// Example 1: One-Time Scan (Simplest Usage)
// ============================================================================

async function example1_BasicScan() {
  console.log('=== Example 1: Basic Scan ===\n');
  
  const config = createDefaultConfig();
  config.githubToken = process.env.GITHUB_TOKEN; // Optional but recommended
  
  try {
    const trends = await scanTrends(config);
    
    console.log(`Found ${trends.length} trending repositories:\n`);
    
    trends.slice(0, 5).forEach((trend, index) => {
      console.log(`${index + 1}. ${trend.fullName}`);
      console.log(`   ⭐ ${trend.stars} stars | 🔥 Trend Score: ${trend.trendScore}/100`);
      console.log(`   📝 ${trend.description || 'No description'}`);
      console.log(`   🔗 ${trend.url}\n`);
    });
  } catch (error) {
    console.error('Scan failed:', (error as Error).message);
  }
}

// ============================================================================
// Example 2: Custom Configuration
// ============================================================================

async function example2_CustomConfig() {
  console.log('=== Example 2: Custom Configuration ===\n');
  
  const config: TrendConfig = {
    githubToken: process.env.GITHUB_TOKEN,
    minStars: 200,
    languages: ['TypeScript', 'Python', 'Rust'],
    topics: ['ai', 'agents', 'mcp', 'llm', 'tools'],
    timeWindowDays: 14, // Last 2 weeks
    maxResults: 30,
    enableBraveSearch: false, // Set to true if you have Brave API key
    braveApiKey: process.env.BRAVE_API_KEY,
  };
  
  try {
    const trends = await scanTrends(config);
    
    // Filter high-quality trends
    const hotTrends = trends.filter((t) => t.trendScore > 70);
    
    console.log(`🔥 Found ${hotTrends.length} HOT trends (score > 70):\n`);
    
    hotTrends.forEach((trend, index) => {
      console.log(`${index + 1}. ${trend.fullName} — ${trend.trendScore}/100`);
      console.log(`   Language: ${trend.language || 'Unknown'}`);
      console.log(`   Topics: ${trend.topics.join(', ') || 'None'}`);
      console.log(`   ${trend.url}\n`);
    });
  } catch (error) {
    console.error('Scan failed:', (error as Error).message);
  }
}

// ============================================================================
// Example 3: Scheduled Daily Scans
// ============================================================================

async function example3_ScheduledScans() {
  console.log('=== Example 3: Scheduled Scans ===\n');
  
  const config = createDefaultConfig();
  config.githubToken = process.env.GITHUB_TOKEN;
  config.topics = ['ai', 'mcp', 'agents'];
  
  try {
    // Note: scheduleTrendRadar is now async (returns Promise)
    const stopScheduler = await scheduleTrendRadar(
      config,
      '0 9 * * *', // Daily at 9:00 AM
      (results) => {
        console.log(`\n📊 Daily TrendRadar Report — ${new Date().toLocaleString()}`);
        console.log(`Found ${results.length} trending repos\n`);
        
        // Show top 3
        results.slice(0, 3).forEach((trend, index) => {
          console.log(`${index + 1}. ${trend.fullName} (${trend.trendScore}/100)`);
          console.log(`   ${trend.description}`);
        });
        
        console.log('\n' + '='.repeat(60) + '\n');
      }
    );
    
    console.log('✅ Scheduler started successfully');
    console.log('💡 Tip: The scheduler will run daily at 9:00 AM');
    console.log('💡 To stop: call stopScheduler()\n');
    
    // Example: Stop after 10 seconds (for testing)
    setTimeout(() => {
      stopScheduler();
      console.log('⏹️  Scheduler stopped');
    }, 10000);
  } catch (error) {
    console.error('Scheduler setup failed:', (error as Error).message);
  }
}

// ============================================================================
// Example 4: Integration with BuilderBrain Classifier
// ============================================================================

async function example4_WithClassifier() {
  console.log('=== Example 4: Integration with Classifier ===\n');
  
  // Import classifier from same engines directory
  const { classifyDomains } = await import('./engines/classifier.js');
  
  const config = createDefaultConfig();
  config.githubToken = process.env.GITHUB_TOKEN;
  
  try {
    const trends = await scanTrends(config);
    
    // Enrich trends with domain classification
    const enrichedTrends = trends.map((trend) => {
      const domains = classifyDomains(trend.description || '');
      return { ...trend, domains };
    });
    
    // Filter for AI-agent-related repos
    const aiAgentTrends = enrichedTrends.filter((t) => 
      t.domains.includes('ai-agents')
    );
    
    console.log(`🤖 Found ${aiAgentTrends.length} AI agent-related trends:\n`);
    
    aiAgentTrends.forEach((trend, index) => {
      console.log(`${index + 1}. ${trend.fullName}`);
      console.log(`   Domains: ${trend.domains.join(', ')}`);
      console.log(`   Score: ${trend.trendScore}/100`);
      console.log(`   ${trend.url}\n`);
    });
  } catch (error) {
    console.error('Scan failed:', (error as Error).message);
  }
}

// ============================================================================
// Example 5: Error Handling and Retry Logic
// ============================================================================

async function example5_ErrorHandling() {
  console.log('=== Example 5: Error Handling ===\n');
  
  const config = createDefaultConfig();
  // Intentionally omit GitHub token to test rate limits
  
  try {
    console.log('⚠️  Running without GitHub token (10 req/min limit)...');
    const trends = await scanTrends(config);
    console.log(`✅ Success: Found ${trends.length} trends`);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        console.error('❌ Rate limited! Wait 60 seconds or add GITHUB_TOKEN');
      } else if (error.message.includes('Max retries')) {
        console.error('❌ GitHub API unavailable after retries');
      } else {
        console.error('❌ Unknown error:', error.message);
      }
    }
  }
}

// ============================================================================
// Run Examples (uncomment the one you want to test)
// ============================================================================

// await example1_BasicScan();
// await example2_CustomConfig();
// await example3_ScheduledScans();
// await example4_WithClassifier();
// await example5_ErrorHandling();

// Default: Run basic scan
await example1_BasicScan();
