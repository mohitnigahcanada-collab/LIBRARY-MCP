import { writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Domain } from './engines/classifier.js';
import { BookEntry } from './engines/bookRouter.js';
import { RiskLevel, ConfidenceLevel } from './engines/riskConfidence.js';
import { redactSecrets } from './security/sanitize.js';

export interface RunLog {
  id: string;
  timestamp: string;
  command: string;
  input: string;
  detectedDomains: Domain[];
  booksUsed: string[];
  risk: RiskLevel;
  confidence: ConfidenceLevel;
  summary: string;
}

export function getRunsDir(): string {
  return join(process.cwd(), 'brain-data', 'runs');
}

export function saveRunLog(log: Omit<RunLog, 'id' | 'timestamp'>): RunLog {
  const runsDir = getRunsDir();
  mkdirSync(runsDir, { recursive: true });

  const entry: RunLog = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    ...log,
    input: redactSecrets(log.input),
    summary: redactSecrets(log.summary),
  };

  const filePath = join(runsDir, `${entry.id}.json`);
  writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf-8');
  return entry;
}

export function listRunLogs(limit = 10): RunLog[] {
  const runsDir = getRunsDir();
  if (!existsSync(runsDir)) return [];

  const files = readdirSync(runsDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, limit);

  return files.map((f) => JSON.parse(readFileSync(join(runsDir, f), 'utf-8')) as RunLog);
}

export function getRunLog(id: string): RunLog | null {
  const filePath = join(getRunsDir(), `${id}.json`);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf-8')) as RunLog;
}
