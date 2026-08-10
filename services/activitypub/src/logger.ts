import { pino } from "pino";

export const REDACTED = "[REDACTED]";

export const SENSITIVE_KEYS = [
  "password",
  "email",
  "token",
  "authorization",
  "card_number",
] as const;

export const MAX_REDACTION_DEPTH = 10;

export const redactPaths = SENSITIVE_KEYS.flatMap((key) => [key, `*.${key}`, `**.*.${key}`]);

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEYS.some((sensitive) => normalized.includes(sensitive));
}

function redact(value: unknown, depth: number, seen: WeakMap<object, object>): unknown {
  if (value === null || typeof value !== "object" || depth > MAX_REDACTION_DEPTH) {
    return value;
  }

  const cached = seen.get(value);
  if (cached) {
    return cached;
  }

  if (Array.isArray(value)) {
    const sanitizedArray: unknown[] = [];
    seen.set(value, sanitizedArray);
    for (const item of value) {
      sanitizedArray.push(redact(item, depth + 1, seen));
    }
    return sanitizedArray;
  }

  const sanitized: Record<string, unknown> = {};
  seen.set(value, sanitized);
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    sanitized[key] = isSensitiveKey(key) ? REDACTED : redact(nestedValue, depth + 1, seen);
  }
  return sanitized;
}

export function redactDeep<T>(value: T): T {
  return redact(value, 0, new WeakMap<object, object>()) as T;
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: redactPaths,
    censor: REDACTED,
  },
});
