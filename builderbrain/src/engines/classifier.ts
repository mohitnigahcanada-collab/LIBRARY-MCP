export type Domain =
  | 'auth'
  | 'database'
  | 'payments'
  | 'security'
  | 'testing'
  | 'debugging'
  | 'frontend'
  | 'backend'
  | 'ai-agents'
  | 'product'
  | 'deployment'
  | 'files'
  | 'browser-automation'
  | 'documentation';

const DOMAIN_KEYWORDS: Record<Domain, string[]> = {
  auth: ['login', 'logout', 'oauth', 'session', 'redirect', 'auth', 'jwt', 'token', 'password', 'signup', 'register', 'permission', 'role'],
  database: ['sql', 'postgres', 'mysql', 'sqlite', 'migration', 'schema', 'query', 'database', 'db', 'table', 'index', 'orm', 'prisma', 'drizzle', 'supabase'],
  payments: ['payment', 'stripe', 'billing', 'invoice', 'subscription', 'checkout', 'refund', 'charge', 'price', 'plan'],
  security: ['security', 'vulnerability', 'xss', 'csrf', 'injection', 'sanitize', 'encrypt', 'hash', 'ssl', 'tls', 'cors', 'helmet', 'audit'],
  testing: ['test', 'vitest', 'jest', 'spec', 'mock', 'stub', 'assert', 'coverage', 'unit test', 'integration test', 'e2e'],
  debugging: ['bug', 'error', 'debug', 'fix', 'crash', 'exception', 'undefined', 'null', 'traceback', 'stack trace', 'broken', 'failing'],
  frontend: ['react', 'vue', 'svelte', 'component', 'css', 'html', 'ui', 'ux', 'tailwind', 'responsive', 'vite', 'next', 'nuxt', 'dom', 'browser'],
  backend: ['api', 'express', 'hono', 'fastify', 'server', 'route', 'endpoint', 'middleware', 'rest', 'graphql', 'node', 'bun', 'deno'],
  'ai-agents': ['ai', 'agent', 'llm', 'prompt', 'context', 'mcp', 'claude', 'openai', 'gpt', 'embedding', 'vector', 'rag', 'tool use', 'function call'],
  product: ['feature', 'roadmap', 'user story', 'mvp', 'v1', 'launch', 'product', 'requirement', 'scope', 'ux flow'],
  deployment: ['deploy', 'docker', 'ci', 'cd', 'pipeline', 'kubernetes', 'cloud', 'aws', 'gcp', 'azure', 'vercel', 'netlify', 'fly', 'production'],
  files: ['file', 'directory', 'folder', 'path', 'read', 'write', 'upload', 'download', 'csv', 'json', 'yaml', 'xml', 'markdown', 'fs'],
  'browser-automation': ['playwright', 'puppeteer', 'selenium', 'scrape', 'screenshot', 'click', 'fill form', 'headless', 'browser automation'],
  documentation: ['docs', 'readme', 'comment', 'jsdoc', 'wiki', 'changelog', 'guide', 'tutorial', 'example'],
};

export function classifyDomains(task: string): Domain[] {
  const lower = task.toLowerCase();
  const matched: Domain[] = [];

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS) as [Domain, string[]][]) {
    if (keywords.some((kw) => lower.includes(kw))) {
      matched.push(domain);
    }
  }

  return matched.length > 0 ? matched : ['backend'];
}
