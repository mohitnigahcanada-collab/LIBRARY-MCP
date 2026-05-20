/**
 * Example: How to Use RepoAnalyzer Engine
 * 
 * This file demonstrates practical usage of the repoAnalyzer engine.
 * Copy these patterns into your CLI, API, or MCP tools.
 */

import { analyzeRepo, saveDiscoveredBook, type RepoAnalysisResult } from '../src/engines/repoAnalyzer.js';
import { loadConfig, getEnabledBackends } from '../src/config/manager.js';

// ============================================================================
// Example 1: Basic Usage
// ============================================================================

async function example1_basic() {
  console.log('=== Example 1: Basic Analysis ===\n');
  
  // Load AI backend config
  const config = loadConfig();
  const backends = getEnabledBackends(config);
  
  if (backends.length === 0) {
    console.error('No AI backends configured. Run `brain config` first.');
    return;
  }
  
  // Analyze a repository
  const repoPath = '/path/to/your/repo';
  const result = await analyzeRepo(repoPath, backends[0]);
  
  // Access results
  console.log('Repository:', result.repoName);
  console.log('Tech Stack:');
  console.log('  Languages:', result.techStack.languages.join(', '));
  console.log('  Frameworks:', result.techStack.frameworks.join(', '));
  console.log('  Build System:', result.techStack.buildSystem);
  console.log('\nArchitecture:', result.architecturePatterns.primary);
  console.log('Patterns:', result.architecturePatterns.patterns.join(', '));
  console.log('\nAnti-patterns found:', result.antipatterns.detected.length);
  console.log('Severity:', result.antipatterns.severity);
  
  // Save mini-book
  await saveDiscoveredBook(result.repoName, result.miniBook);
  console.log('\n✅ Mini-book saved to brain-data/library/discovered/');
}

// ============================================================================
// Example 2: Custom Configuration
// ============================================================================

async function example2_custom_config() {
  console.log('=== Example 2: Custom Configuration ===\n');
  
  const config = loadConfig();
  const backends = getEnabledBackends(config);
  const repoPath = '/path/to/large/repo';
  
  // Analyze with custom limits
  const result = await analyzeRepo(repoPath, backends[0], {
    maxFileSize: 2 * 1024 * 1024, // 2MB instead of 1MB
    timeout: 5 * 60 * 1000, // 5 minutes instead of 2
    maxFiles: 50, // 50 files instead of 30
    ignorePatterns: [
      'node_modules',
      'dist',
      'build',
      '.git',
      'coverage',
      '__pycache__', // Python
      'vendor', // Go/PHP
      'target', // Rust/Java
    ],
  });
  
  console.log('Analyzed:', result.metadata.fileCount, 'files');
  console.log('Total lines:', result.metadata.totalLines);
  console.log('Analysis time:', result.metadata.analysisTime, 'ms');
  console.log('AI backend used:', result.metadata.aiBackend);
}

// ============================================================================
// Example 3: Extracting Specific Insights
// ============================================================================

async function example3_specific_insights() {
  console.log('=== Example 3: Extracting Specific Insights ===\n');
  
  const config = loadConfig();
  const backends = getEnabledBackends(config);
  const repoPath = '/path/to/react/app';
  
  const result = await analyzeRepo(repoPath, backends[0]);
  
  // Extract React-specific patterns
  console.log('🔍 Looking for React patterns...\n');
  
  if (result.techStack.frameworks.includes('React')) {
    console.log('✅ React detected!');
    console.log('State management:', 
      result.techStack.libraries.find(lib => 
        ['zustand', 'redux', 'mobx', 'jotai'].includes(lib.toLowerCase())
      ) || 'None detected'
    );
    console.log('Routing:', 
      result.techStack.libraries.find(lib => 
        lib.toLowerCase().includes('router')
      ) || 'None detected'
    );
  }
  
  // Extract testing strategy
  console.log('\n🧪 Testing Strategy:');
  console.log('Testing framework:', result.techStack.testing?.join(', ') || 'None detected');
  console.log('Testing conventions:', result.conventions.testing);
  
  // Extract architecture quality
  console.log('\n🏗️ Architecture Quality:');
  console.log('Principles:', result.architecturePatterns.principles.join(', '));
  console.log('Anti-patterns:', result.antipatterns.detected.length);
  console.log('Overall quality:', 
    result.antipatterns.severity === 'low' ? '🟢 High' :
    result.antipatterns.severity === 'medium' ? '🟡 Good' : '🔴 Needs Work'
  );
}

// ============================================================================
// Example 4: Extracting Reusable Snippets
// ============================================================================

async function example4_snippets() {
  console.log('=== Example 4: Extracting Reusable Snippets ===\n');
  
  const config = loadConfig();
  const backends = getEnabledBackends(config);
  const repoPath = '/path/to/well-architected/repo';
  
  const result = await analyzeRepo(repoPath, backends[0]);
  
  console.log(`Found ${result.extractedSnippets.length} reusable patterns:\n`);
  
  for (const snippet of result.extractedSnippets) {
    console.log(`📦 ${snippet.title} [${snippet.category}]`);
    console.log(`   File: ${snippet.filePath}`);
    console.log(`   Description: ${snippet.description}`);
    console.log(`   Code preview: ${snippet.code.split('\n')[0]}...`);
    console.log('');
  }
  
  // Filter by category
  const utilitySnippets = result.extractedSnippets.filter(s => s.category === 'utility');
  console.log(`\n🔧 Utility functions: ${utilitySnippets.length}`);
  
  const patternSnippets = result.extractedSnippets.filter(s => s.category === 'pattern');
  console.log(`🎨 Design patterns: ${patternSnippets.length}`);
}

// ============================================================================
// Example 5: Analyzing Multiple Repos (Batch)
// ============================================================================

async function example5_batch() {
  console.log('=== Example 5: Batch Analysis ===\n');
  
  const config = loadConfig();
  const backends = getEnabledBackends(config);
  
  const repos = [
    '/path/to/repo1',
    '/path/to/repo2',
    '/path/to/repo3',
  ];
  
  const results: RepoAnalysisResult[] = [];
  
  for (const repoPath of repos) {
    console.log(`\nAnalyzing: ${repoPath}...`);
    try {
      const result = await analyzeRepo(repoPath, backends[0]);
      results.push(result);
      await saveDiscoveredBook(result.repoName, result.miniBook);
      console.log(`✅ ${result.repoName} analyzed (${result.metadata.analysisTime}ms)`);
    } catch (err) {
      console.error(`❌ Failed to analyze ${repoPath}:`, err);
    }
  }
  
  // Compare results
  console.log('\n\n=== Comparison ===\n');
  console.log('Repo | Architecture | Tech Stack | Quality');
  console.log('-----|--------------|------------|--------');
  for (const r of results) {
    console.log(
      `${r.repoName.padEnd(15)} | ` +
      `${r.architecturePatterns.primary.slice(0, 20).padEnd(20)} | ` +
      `${r.techStack.frameworks.join(',').slice(0, 15).padEnd(15)} | ` +
      `${r.antipatterns.severity}`
    );
  }
  
  // Find common patterns
  const allPatterns = results.flatMap(r => r.architecturePatterns.patterns);
  const patternCounts = allPatterns.reduce((acc, p) => {
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('\n\n=== Common Patterns Across Repos ===\n');
  Object.entries(patternCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([pattern, count]) => {
      console.log(`${pattern}: ${count}/${results.length} repos`);
    });
}

// ============================================================================
// Example 6: Error Handling
// ============================================================================

async function example6_error_handling() {
  console.log('=== Example 6: Error Handling ===\n');
  
  const config = loadConfig();
  const backends = getEnabledBackends(config);
  
  try {
    // This will fail: repo doesn't exist
    await analyzeRepo('/nonexistent/path', backends[0]);
  } catch (err) {
    if (err instanceof Error && err.message.includes('does not exist')) {
      console.log('✅ Correctly caught: Repository path does not exist');
    }
  }
  
  try {
    // This will fail: no backends configured
    await analyzeRepo('/some/path', {
      name: 'fake-backend',
      type: 'openai',
      priority: 1,
      enabled: false,
      apiKey: '',
    });
  } catch (err) {
    console.log('✅ Handled missing backend gracefully');
  }
  
  // Timeout handling (mock)
  console.log('\n⏱️ Timeout protection: Analysis will abort after 2 minutes');
  console.log('   (prevents hanging on huge repos)');
  
  // File size limits
  console.log('\n📏 File size limits: Files >1MB are skipped');
  console.log('   (prevents analyzing minified bundles)');
  
  // Ignore patterns
  console.log('\n🚫 Ignore patterns: node_modules, dist, .git skipped');
  console.log('   (focuses on source code only)');
}

// ============================================================================
// Example 7: Integration with BuilderBrain Workflow
// ============================================================================

async function example7_builderbrain_integration() {
  console.log('=== Example 7: BuilderBrain Integration ===\n');
  
  // Step 1: User asks to learn from a trending repo
  console.log('User: "I found a cool repo on GitHub. Can BuilderBrain learn from it?"');
  console.log('Agent: "Sure! Let me analyze it..."\n');
  
  const config = loadConfig();
  const backends = getEnabledBackends(config);
  const trendingRepo = '/tmp/cloned-trending-repo';
  
  // Step 2: Analyze the repo
  console.log('[Agent] Analyzing repository...');
  const result = await analyzeRepo(trendingRepo, backends[0]);
  
  // Step 3: Save as discovered book
  console.log('[Agent] Saving knowledge...');
  const bookPath = await saveDiscoveredBook(result.repoName, result.miniBook);
  
  // Step 4: Report findings
  console.log('\n[Agent] ✅ Analysis complete!\n');
  console.log('Key findings:');
  console.log(`  • Architecture: ${result.architecturePatterns.primary}`);
  console.log(`  • Tech stack: ${result.techStack.frameworks.join(', ')}`);
  console.log(`  • Patterns: ${result.architecturePatterns.patterns.slice(0, 3).join(', ')}`);
  console.log(`  • Quality: ${result.antipatterns.severity}`);
  console.log(`\n📚 Knowledge saved to: ${bookPath}`);
  console.log('\nUser: "Thanks! Can you use these patterns in my next project?"');
  console.log('Agent: "Yes! I\'ll reference this book when building similar features."\n');
  
  // Step 5: Future task references this book
  console.log('[Future Task] User: "Build a React app with clean architecture"');
  console.log('[Agent] Checking library for relevant books...');
  console.log(`[Agent] Found: ${result.repoName} (similar architecture)`);
  console.log('[Agent] Applying patterns from discovered book...');
  console.log('[Agent] ✅ Project scaffolded using learned patterns!\n');
}

// ============================================================================
// Run Examples
// ============================================================================

async function main() {
  console.log('🧠 BuilderBrain RepoAnalyzer - Usage Examples\n');
  console.log('=' .repeat(70) + '\n');
  
  // Uncomment to run specific examples:
  
  // await example1_basic();
  // await example2_custom_config();
  // await example3_specific_insights();
  // await example4_snippets();
  // await example5_batch();
  // await example6_error_handling();
  // await example7_builderbrain_integration();
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ Examples completed! Check the code above for usage patterns.');
  console.log('\nTo run a specific example, uncomment it in main() and run:');
  console.log('  tsx examples/repoAnalyzer-usage.ts\n');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
