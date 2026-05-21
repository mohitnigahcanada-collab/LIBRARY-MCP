import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { redactSecrets } from '../security/sanitize.js';

export interface ReviewLearningEntry {
  timestamp: string;
  conversationId: string;
  task?: string;
  userMessage: string;
  primaryBackend: string;
  primaryModel: string;
  reviewerBackend: string;
  reviewerModel: string;
  improvementAccepted: boolean;
  primaryPreview: string;
  reviewerPreview: string;
}

function getReviewLearningPath(): string {
  return join(process.cwd(), 'brain-data', 'chat-history', 'review-learning.jsonl');
}

export function saveReviewLearning(entry: ReviewLearningEntry): void {
  const path = getReviewLearningPath();
  mkdirSync(join(process.cwd(), 'brain-data', 'chat-history'), { recursive: true });
  const safe: ReviewLearningEntry = {
    ...entry,
    userMessage: redactSecrets(entry.userMessage),
    primaryPreview: redactSecrets(entry.primaryPreview),
    reviewerPreview: redactSecrets(entry.reviewerPreview),
  };
  appendFileSync(path, JSON.stringify(safe) + '\n', 'utf-8');
}
