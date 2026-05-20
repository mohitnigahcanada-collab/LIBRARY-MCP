/**
 * Repository Analyzer Engine
 * 
 * Production-grade AI-powered codebase analyzer that extracts:
 * - Architecture patterns (MVC, Clean Architecture, Microservices, etc.)
 * - Tech stack (frameworks, libraries, tools)
 * - Code conventions (naming, structure, patterns)
 * - Anti-patterns and code smells
 * - Reusable code snippets
 * 
 * Uses multi-turn LLM conversation:
 * 1. Get file tree → Ask LLM which files to analyze
 * 2. Read selected files → Ask for deep analysis
 * 3. Generate a "mini-book" markdown document
 * 
 * @module engines/repoAnalyzer
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, relative, extname, basename } from 'path';
import { routeChat, type ChatMessage } from './aiRouter.js';
import type { AIBackend } from '../config/manager.js';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Result of repository analysis containing all extracted knowledge
 */
export interface RepoAnalysisResult {
  /** Repository name/path that was analyzed */
  repoName: string;
  
  /** Detected technology stack (frameworks, libraries, languages, tools) */
  techStack: {
    languages: string[];
    frameworks: string[];
    libraries: string[];
    tools: string[];
    buildSystem?: string;
    packageManager?: string;
    testing?: string[];
  };
  
  /** Detected architecture patterns and design principles */
  architecturePatterns: {
    primary: string; // e.g., "Clean Architecture", "MVC", "Microservices"
    patterns: string[]; // e.g., ["Repository Pattern", "Factory Pattern"]
    principles: string[]; // e.g., ["SOLID", "DRY", "KISS"]
    folderStructure: string; // Description of how code is organized
  };
  
  /** Code conventions and style guidelines observed */
  conventions: {
    naming: string; // e.g., "camelCase for variables, PascalCase for classes"
    fileOrganization: string; // e.g., "Feature-based folders"
    importStyle: string; // e.g., "ES6 imports with .js extensions"
    errorHandling: string; // e.g., "Try-catch with custom error classes"
    testing: string; // e.g., "Vitest with .test.ts suffix"
    documentation: string; // e.g., "JSDoc comments for public APIs"
  };
  
  /** Detected anti-patterns and potential issues */
  antipatterns: {
    detected: string[]; // List of anti-patterns found
    severity: 'low' | 'medium' | 'high';
    suggestions: string[]; // How to fix them
  };
  
  /** Extracted reusable code snippets and patterns */
  extractedSnippets: Array<{
    title: string;
    description: string;
    code: string;
    filePath: string;
    category: 'utility' | 'pattern' | 'config' | 'architecture' | 'other';
  }>;
  
  /** Full mini-book markdown content */
  miniBook: string;
  
  /** Analysis metadata */
  metadata: {
    analyzedAt: string;
    fileCount: number;
    totalLines: number;
    analysisTime: number; // milliseconds
    aiBackend: string;
    version: string;
  };
}

/**
 * File tree entry for LLM selection
 */
interface FileNode {
  path: string;
  relativePath: string;
  type: 'file' | 'directory';
  size?: number;
  extension?: string;
}

/**
 * Analysis configuration
 */
interface AnalysisConfig {
  maxFileSize: number; // bytes (default: 1MB)
  timeout: number; // milliseconds (default: 2 minutes)
  maxFiles: number; // max files to analyze (default: 30)
  ignorePatterns: string[]; // patterns to ignore
}

const DEFAULT_CONFIG: AnalysisConfig = {
  maxFileSize: 1024 * 1024, // 1MB
  timeout: 2 * 60 * 1000, // 2 minutes
  maxFiles: 30,
  ignorePatterns: [
    'node_modules',
    'dist',
    'build',
    '.git',
    'coverage',
    '.next',
    '.vite',
    '*.map',
    '*.lock',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
  ],
};

// ============================================================================
// File System Utilities
// ============================================================================

/**
 * Check if path should be ignored based on patterns
 */
function shouldIgnore(path: string, patterns: string[]): boolean {
  const pathParts = path.split('/');
  return patterns.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(path);
    }
    return pathParts.includes(pattern) || path.includes(pattern);
  });
}

/**
 * Recursively build file tree with size limits
 */
function buildFileTree(
  rootPath: string,
  config: AnalysisConfig,
  currentPath: string = rootPath,
  depth: number = 0
): FileNode[] {
  if (depth > 10) return []; // Prevent infinite recursion
  
  const nodes: FileNode[] = [];
  
  try {
    const entries = readdirSync(currentPath);
    
    for (const entry of entries) {
      const fullPath = join(currentPath, entry);
      const relativePath = relative(rootPath, fullPath);
      
      if (shouldIgnore(relativePath, config.ignorePatterns)) {
        continue;
      }
      
      try {
        const stats = statSync(fullPath);
        
        if (stats.isDirectory()) {
          nodes.push({
            path: fullPath,
            relativePath,
            type: 'directory',
          });
          // Recursively add directory contents
          nodes.push(...buildFileTree(rootPath, config, fullPath, depth + 1));
        } else if (stats.isFile() && stats.size <= config.maxFileSize) {
          const ext = extname(entry);
          // Only include source code files
          if (['.ts', '.js', '.tsx', '.jsx', '.json', '.md', '.yaml', '.yml', '.toml'].includes(ext)) {
            nodes.push({
              path: fullPath,
              relativePath,
              type: 'file',
              size: stats.size,
              extension: ext,
            });
          }
        }
      } catch {
        // Skip files we can't stat
        continue;
      }
    }
  } catch {
    // Skip directories we can't read
  }
  
  return nodes;
}

/**
 * Format file tree for LLM consumption
 */
function formatFileTree(nodes: FileNode[]): string {
  const files = nodes.filter(n => n.type === 'file');
  const dirs = nodes.filter(n => n.type === 'directory');
  
  let output = '# Repository File Tree\n\n';
  output += `## Directories (${dirs.length})\n`;
  output += dirs.slice(0, 50).map(d => `- ${d.relativePath}/`).join('\n');
  if (dirs.length > 50) output += `\n... and ${dirs.length - 50} more directories`;
  
  output += '\n\n## Files (${files.length})\n';
  const grouped = files.reduce((acc, f) => {
    const ext = f.extension || 'other';
    if (!acc[ext]) acc[ext] = [];
    acc[ext].push(f);
    return acc;
  }, {} as Record<string, FileNode[]>);
  
  for (const [ext, fileList] of Object.entries(grouped)) {
    output += `\n### ${ext} files (${fileList.length})\n`;
    output += fileList.slice(0, 20).map(f => 
      `- ${f.relativePath} (${(f.size! / 1024).toFixed(1)}KB)`
    ).join('\n');
    if (fileList.length > 20) {
      output += `\n... and ${fileList.length - 20} more ${ext} files`;
    }
  }
  
  return output;
}

/**
 * Read key files that should always be analyzed
 */
function readKeyFiles(repoPath: string): Map<string, string> {
  const keyFiles = new Map<string, string>();
  const priorityFiles = [
    'package.json',
    'tsconfig.json',
    'README.md',
    'vite.config.ts',
    'vitest.config.ts',
    'next.config.js',
    'nuxt.config.ts',
    '.eslintrc.json',
    'tailwind.config.js',
    'Dockerfile',
    'docker-compose.yml',
  ];
  
  for (const file of priorityFiles) {
    const filePath = join(repoPath, file);
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        keyFiles.set(file, content);
      } catch {
        // Skip if can't read
      }
    }
  }
  
  return keyFiles;
}

// ============================================================================
// LLM Prompts
// ============================================================================

/**
 * Prompt template for file selection (Phase 1)
 */
function createFileSelectionPrompt(fileTree: string, keyFilesContent: string): string {
  return `You are an elite code architecture analyst. Your task is to analyze a codebase and select the most important files to read for understanding the architecture, patterns, and conventions.

## Key Files Already Read
${keyFilesContent}

${fileTree}

**Your task:** Select 15-20 files that are most representative of:
1. Core architecture (main entry points, routing, state management)
2. Key business logic (domain models, services, core features)
3. Common patterns (utilities, helpers, hooks, components)
4. Configuration and infrastructure

**Output format:** Return ONLY a JSON array of file paths, nothing else.
Example:
[
  "src/index.ts",
  "src/core/app.ts",
  "src/features/users/service.ts"
]

Be strategic - pick files that reveal the most about how this codebase is structured and what patterns it follows.`;
}

/**
 * Prompt template for deep analysis (Phase 2)
 */
function createAnalysisPrompt(repoName: string, keyFiles: string, selectedFiles: string): string {
  return `You are an elite software architect conducting a comprehensive codebase analysis. Your goal is to extract all architectural knowledge, patterns, conventions, and best practices from this repository.

# Repository: ${repoName}

## Key Configuration Files
${keyFiles}

## Selected Source Files
${selectedFiles}

**Your task:** Analyze this codebase deeply and extract:

1. **Tech Stack:**
   - Languages, frameworks, libraries
   - Build system, package manager, testing tools
   - Any notable dependencies

2. **Architecture Patterns:**
   - Primary architecture style (Clean Architecture, MVC, Microservices, etc.)
   - Design patterns used (Repository, Factory, Singleton, etc.)
   - Principles followed (SOLID, DRY, KISS, etc.)
   - Folder structure philosophy

3. **Code Conventions:**
   - Naming conventions (variables, functions, classes, files)
   - File organization approach (feature-based, layer-based, etc.)
   - Import/export style
   - Error handling patterns
   - Testing conventions
   - Documentation style

4. **Anti-patterns (if any):**
   - Code smells
   - Violations of best practices
   - Technical debt areas

5. **Reusable Patterns & Snippets:**
   - Extract 3-5 code patterns that could be reused
   - Include: utility functions, architectural patterns, config examples

**Output format:** Return a valid JSON object with this exact structure:
{
  "techStack": {
    "languages": ["TypeScript"],
    "frameworks": ["React", "Hono"],
    "libraries": ["zod", "better-sqlite3"],
    "tools": ["Vite", "Vitest"],
    "buildSystem": "Vite",
    "packageManager": "npm",
    "testing": ["Vitest"]
  },
  "architecturePatterns": {
    "primary": "Clean Architecture with feature modules",
    "patterns": ["Repository Pattern", "Dependency Injection"],
    "principles": ["SOLID", "DRY", "Single Responsibility"],
    "folderStructure": "Feature-based modules with engines, memory, and API layers"
  },
  "conventions": {
    "naming": "camelCase for functions/variables, PascalCase for types/interfaces",
    "fileOrganization": "Feature-based folders under src/, shared utilities in engines/",
    "importStyle": "ES6 imports with .js extensions for TypeScript files",
    "errorHandling": "Try-catch blocks with custom error types",
    "testing": "Vitest with .test.ts files co-located with source",
    "documentation": "JSDoc comments for exported functions and types"
  },
  "antipatterns": {
    "detected": ["Some functions exceed 50 lines", "Nested ternary operators in formatters"],
    "severity": "low",
    "suggestions": ["Break down large functions", "Use early returns instead of nested ternaries"]
  },
  "extractedSnippets": [
    {
      "title": "AI Router with Fallback",
      "description": "Robust AI backend router with automatic fallback",
      "code": "export async function routeChat(messages: ChatMessage[]): Promise<ChatResponse> { ... }",
      "filePath": "src/engines/aiRouter.ts",
      "category": "pattern"
    }
  ]
}

Be thorough, precise, and extract real insights. This analysis will be saved as knowledge for future projects.`;
}

// ============================================================================
// Core Analysis Engine
// ============================================================================

/**
 * Main repository analysis function
 * 
 * @param repoPath - Absolute path to repository root
 * @param aiBackend - AI backend configuration (unused, uses routeChat auto-routing)
 * @returns Complete analysis result with tech stack, patterns, and conventions
 * 
 * @example
 * ```typescript
 * const result = await analyzeRepo('/path/to/repo', myBackend);
 * console.log(result.techStack.frameworks); // ['React', 'Hono']
 * await saveDiscoveredBook(result.repoName, result.miniBook);
 * ```
 */
export async function analyzeRepo(
  repoPath: string,
  aiBackend: AIBackend,
  config: Partial<AnalysisConfig> = {}
): Promise<RepoAnalysisResult> {
  const startTime = Date.now();
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Validate repo path
  if (!existsSync(repoPath)) {
    throw new Error(`Repository path does not exist: ${repoPath}`);
  }
  
  const repoName = basename(repoPath);
  
  console.log(`[RepoAnalyzer] Starting analysis of: ${repoName}`);
  console.log(`[RepoAnalyzer] Config: maxFiles=${fullConfig.maxFiles}, timeout=${fullConfig.timeout}ms`);
  
  // Phase 1: Build file tree
  console.log('[RepoAnalyzer] Phase 1: Building file tree...');
  const fileTree = buildFileTree(repoPath, fullConfig);
  const fileTreeFormatted = formatFileTree(fileTree);
  
  // Read key files
  const keyFiles = readKeyFiles(repoPath);
  const keyFilesContent = Array.from(keyFiles.entries())
    .map(([name, content]) => `### ${name}\n\`\`\`\n${content.slice(0, 2000)}\n\`\`\``)
    .join('\n\n');
  
  console.log(`[RepoAnalyzer] Found ${fileTree.length} files, ${keyFiles.size} key config files`);
  
  // Phase 2: Ask LLM which files to analyze
  console.log('[RepoAnalyzer] Phase 2: Selecting files to analyze (LLM)...');
  const fileSelectionMessages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are a code architecture analyst. You select the most important files for understanding a codebase.',
    },
    {
      role: 'user',
      content: createFileSelectionPrompt(fileTreeFormatted, keyFilesContent),
    },
  ];
  
  const selectionResponse = await routeChat(fileSelectionMessages);
  console.log(`[RepoAnalyzer] LLM backend: ${selectionResponse.backend}`);
  
  // Parse selected files
  let selectedFilePaths: string[] = [];
  try {
    const jsonMatch = selectionResponse.text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      selectedFilePaths = JSON.parse(jsonMatch[0]);
    } else {
      // Fallback: extract file paths from text
      selectedFilePaths = selectionResponse.text
        .split('\n')
        .filter(line => line.includes('/') && !line.includes('```'))
        .map(line => line.replace(/^[-*\s"'`]+|["'`]+$/g, '').trim())
        .filter(Boolean)
        .slice(0, fullConfig.maxFiles);
    }
  } catch (err) {
    console.warn('[RepoAnalyzer] Failed to parse LLM file selection, using fallback strategy');
    // Fallback: select files based on heuristics
    selectedFilePaths = fileTree
      .filter(f => f.type === 'file' && (
        f.relativePath.includes('src/') ||
        f.relativePath.includes('index') ||
        f.relativePath.includes('main') ||
        f.relativePath.includes('app')
      ))
      .slice(0, fullConfig.maxFiles)
      .map(f => f.relativePath);
  }
  
  console.log(`[RepoAnalyzer] Selected ${selectedFilePaths.length} files to analyze`);
  
  // Phase 3: Read selected files
  console.log('[RepoAnalyzer] Phase 3: Reading selected files...');
  const selectedFilesContent = new Map<string, string>();
  let totalLines = 0;
  
  for (const relPath of selectedFilePaths) {
    const fullPath = join(repoPath, relPath);
    if (existsSync(fullPath)) {
      try {
        const content = readFileSync(fullPath, 'utf-8');
        selectedFilesContent.set(relPath, content);
        totalLines += content.split('\n').length;
      } catch {
        // Skip files we can't read
      }
    }
  }
  
  const selectedFilesFormatted = Array.from(selectedFilesContent.entries())
    .map(([path, content]) => {
      // Truncate very large files
      const truncated = content.length > 10000 ? content.slice(0, 10000) + '\n... (truncated)' : content;
      return `### ${path}\n\`\`\`\n${truncated}\n\`\`\``;
    })
    .join('\n\n');
  
  console.log(`[RepoAnalyzer] Read ${selectedFilesContent.size} files (${totalLines} lines total)`);
  
  // Phase 4: Deep analysis with LLM
  console.log('[RepoAnalyzer] Phase 4: Performing deep analysis (LLM)...');
  const analysisMessages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are an elite software architect. You extract architectural patterns, conventions, and best practices from codebases.',
    },
    {
      role: 'user',
      content: createAnalysisPrompt(repoName, keyFilesContent, selectedFilesFormatted),
    },
  ];
  
  const analysisResponse = await routeChat(analysisMessages);
  
  // Parse analysis result
  let analysisData: any = {};
  try {
    const jsonMatch = analysisResponse.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      analysisData = JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.error('[RepoAnalyzer] Failed to parse LLM analysis response:', err);
    throw new Error('Failed to parse AI analysis result. The AI may have returned invalid JSON.');
  }
  
  // Phase 5: Generate mini-book
  console.log('[RepoAnalyzer] Phase 5: Generating mini-book...');
  const miniBook = generateMiniBook(repoName, analysisData, {
    fileCount: selectedFilesContent.size,
    totalLines,
  });
  
  const analysisTime = Date.now() - startTime;
  console.log(`[RepoAnalyzer] ✅ Analysis complete in ${analysisTime}ms`);
  
  // Assemble final result
  const result: RepoAnalysisResult = {
    repoName,
    techStack: analysisData.techStack || {},
    architecturePatterns: analysisData.architecturePatterns || {},
    conventions: analysisData.conventions || {},
    antipatterns: analysisData.antipatterns || { detected: [], severity: 'low', suggestions: [] },
    extractedSnippets: analysisData.extractedSnippets || [],
    miniBook,
    metadata: {
      analyzedAt: new Date().toISOString(),
      fileCount: selectedFilesContent.size,
      totalLines,
      analysisTime,
      aiBackend: analysisResponse.backend,
      version: '1.0.0',
    },
  };
  
  return result;
}

/**
 * Generate a "mini-book" markdown document from analysis
 */
function generateMiniBook(
  repoName: string,
  analysisData: any,
  stats: { fileCount: number; totalLines: number }
): string {
  const { techStack, architecturePatterns, conventions, antipatterns, extractedSnippets } = analysisData;
  
  return `# ${repoName} - Discovered Knowledge Book

> **Auto-generated by BuilderBrain RepoAnalyzer**  
> Generated: ${new Date().toLocaleString()}  
> Files Analyzed: ${stats.fileCount} | Lines: ${stats.totalLines}

---

## 📚 Tech Stack

### Languages
${techStack?.languages?.map((l: string) => `- ${l}`).join('\n') || '- (not detected)'}

### Frameworks
${techStack?.frameworks?.map((f: string) => `- ${f}`).join('\n') || '- (not detected)'}

### Libraries & Tools
${techStack?.libraries?.map((l: string) => `- ${l}`).join('\n') || '- (not detected)'}

**Build System:** ${techStack?.buildSystem || 'Unknown'}  
**Package Manager:** ${techStack?.packageManager || 'Unknown'}  
**Testing:** ${techStack?.testing?.join(', ') || 'Unknown'}

---

## 🏗️ Architecture Patterns

**Primary Architecture:** ${architecturePatterns?.primary || 'Not detected'}

### Design Patterns Used
${architecturePatterns?.patterns?.map((p: string) => `- ${p}`).join('\n') || '- (none detected)'}

### Principles Followed
${architecturePatterns?.principles?.map((p: string) => `- ${p}`).join('\n') || '- (none detected)'}

### Folder Structure
${architecturePatterns?.folderStructure || 'Not analyzed'}

---

## 📝 Code Conventions

### Naming Conventions
${conventions?.naming || 'Not documented'}

### File Organization
${conventions?.fileOrganization || 'Not documented'}

### Import Style
${conventions?.importStyle || 'Not documented'}

### Error Handling
${conventions?.errorHandling || 'Not documented'}

### Testing Conventions
${conventions?.testing || 'Not documented'}

### Documentation Style
${conventions?.documentation || 'Not documented'}

---

## ⚠️ Anti-patterns & Issues

**Severity:** ${antipatterns?.severity || 'N/A'}

### Detected Issues
${antipatterns?.detected?.map((a: string) => `- ${a}`).join('\n') || '- None detected'}

### Suggestions
${antipatterns?.suggestions?.map((s: string) => `- ${s}`).join('\n') || '- N/A'}

---

## 🎯 Reusable Patterns & Snippets

${extractedSnippets?.map((snippet: any, i: number) => `
### ${i + 1}. ${snippet.title} [\`${snippet.category}\`]

**File:** \`${snippet.filePath}\`

${snippet.description}

\`\`\`typescript
${snippet.code}
\`\`\`
`).join('\n') || '(No snippets extracted)'}

---

## 📊 Analysis Summary

This codebase demonstrates:
- **Architecture:** ${architecturePatterns?.primary || 'Unknown pattern'}
- **Quality:** ${antipatterns?.severity === 'low' ? 'High (minimal issues)' : antipatterns?.severity === 'medium' ? 'Good (some improvements needed)' : 'Needs attention'}
- **Conventions:** ${conventions?.naming ? 'Well-documented and consistent' : 'Implicit or inconsistent'}
- **Reusability:** ${extractedSnippets?.length || 0} patterns extracted

Use this knowledge book when building similar projects or when you need reference implementations of these patterns.

---

*End of Discovery Book*
`;
}

// ============================================================================
// Save Discovered Book
// ============================================================================

/**
 * Save a discovered knowledge book to the library
 * 
 * @param repoName - Name of the repository
 * @param content - Full mini-book markdown content
 * @returns Path where the book was saved
 * 
 * @example
 * ```typescript
 * await saveDiscoveredBook('my-awesome-repo', miniBookContent);
 * // Saves to: brain-data/library/discovered/my-awesome-repo.md
 * ```
 */
export async function saveDiscoveredBook(repoName: string, content: string): Promise<string> {
  const libraryPath = join(process.cwd(), 'brain-data', 'library', 'discovered');
  
  // Ensure directory exists
  mkdirSync(libraryPath, { recursive: true });
  
  // Sanitize repo name for filename
  const safeName = repoName
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  const filePath = join(libraryPath, `${safeName}.md`);
  
  writeFileSync(filePath, content, 'utf-8');
  console.log(`[RepoAnalyzer] 📚 Saved discovered book to: ${relative(process.cwd(), filePath)}`);
  
  return filePath;
}

// ============================================================================
// Exports
// ============================================================================

export type { FileNode, AnalysisConfig };
export { DEFAULT_CONFIG as DEFAULT_ANALYSIS_CONFIG };
