import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { redactSecrets } from '../security/sanitize.js';

export interface ChatTraceEntry {
  id: string;
  conversationId: string;
  timestamp: string;
  task?: string;
  userMessage: string;
  assistantMessage: string;
  backend: string;
  model: string;
  tokens?: number;
}

export interface ChatConversationSummary {
  conversationId: string;
  turns: number;
  updatedAt: string;
  title: string;
}

function getChatDir(): string {
  return join(process.cwd(), 'brain-data', 'chat-history');
}

function getConversationFile(conversationId: string): string {
  return join(getChatDir(), `${conversationId}.jsonl`);
}

function parseConversationId(id?: string): string {
  const clean = (id ?? '').trim();
  if (!clean) return `conv_${Date.now()}_${uuidv4().slice(0, 8)}`;
  return clean.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}

export function saveChatTrace(input: Omit<ChatTraceEntry, 'id' | 'timestamp' | 'conversationId'> & { conversationId?: string }): ChatTraceEntry {
  const conversationId = parseConversationId(input.conversationId);
  const entry: ChatTraceEntry = {
    id: uuidv4(),
    conversationId,
    timestamp: new Date().toISOString(),
    task: input.task,
    userMessage: redactSecrets(input.userMessage),
    assistantMessage: redactSecrets(input.assistantMessage),
    backend: input.backend,
    model: input.model,
    tokens: input.tokens,
  };

  mkdirSync(getChatDir(), { recursive: true });
  appendFileSync(getConversationFile(conversationId), JSON.stringify(entry) + '\n', 'utf-8');
  return entry;
}

export function getConversationHistory(conversationId: string): ChatTraceEntry[] {
  const raw = (conversationId ?? '').trim();
  const candidates = Array.from(new Set([
    raw,
    raw.replace(/^\/+/, ''),
    parseConversationId(raw),
  ])).filter(Boolean);

  const file = candidates
    .map((id) => getConversationFile(id))
    .find((candidate) => existsSync(candidate));

  if (!file) return [];
  const lines = readFileSync(file, 'utf-8').split('\n').filter(Boolean);
  return lines
    .map((line) => {
      try {
        return JSON.parse(line) as ChatTraceEntry;
      } catch {
        return null;
      }
    })
    .filter((x): x is ChatTraceEntry => x !== null)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function listConversations(limit = 50): ChatConversationSummary[] {
  const dir = getChatDir();
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
  const summaries: ChatConversationSummary[] = [];

  for (const file of files) {
    const conversationId = file.replace(/\.jsonl$/, '');
    const history = getConversationHistory(conversationId);
    if (history.length === 0) continue;
    const first = history[0];
    const last = history[history.length - 1];
    summaries.push({
      conversationId,
      turns: history.length,
      updatedAt: last.timestamp,
      title: first.userMessage.slice(0, 80),
    });
  }

  return summaries
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, Math.max(1, limit));
}
