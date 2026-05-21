const SECRET_PATTERNS: RegExp[] = [
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/g,
  /\bAIza[0-9A-Za-z\-_]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{16,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\b[0-9]{6,}:[A-Za-z0-9_-]{30,}\b/g,
  /https:\/\/hooks\.slack\.com\/services\/[^\s)]+/g,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
];

export function redactSecrets(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

export function sanitizeMemoryText(text: string, maxLength = 4000): string {
  const trimmed = text.trim().slice(0, maxLength);
  return redactSecrets(trimmed);
}

export function maskValue(value?: string): string | undefined {
  if (!value) return undefined;
  if (value.length <= 6) return '***';
  return `${value.slice(0, 3)}***${value.slice(-2)}`;
}
