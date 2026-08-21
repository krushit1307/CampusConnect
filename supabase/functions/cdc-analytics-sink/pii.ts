export const REDACTED = "[REDACTED]";

const SENSITIVE_KEY_PATTERN =
  /(password|passwd|email|token|authorization|auth_header|card_number|card_no|phone|ssn|first_name|last_name|date_of_birth|dob|avatar_url|national_id)/i;

/**
 * Deep-redacts PII from arbitrary JSON payloads before they are persisted
 * to the analytics sink. Keys are matched case-insensitively by name, and
 * arrays/objects are recursed into (cycle-safe).
 */
export function redactPII(value: unknown, seen?: WeakMap<object, unknown>): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  seen = seen ?? new WeakMap<object, unknown>();

  if (seen.has(value)) {
    return seen.get(value);
  }

  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    seen.set(value, copy);
    for (const item of value) {
      copy.push(redactPII(item, seen));
    }
    return copy;
  }

  const copy: Record<string, unknown> = {};
  seen.set(value, copy);

  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      copy[key] = REDACTED;
    } else {
      copy[key] = redactPII(item, seen);
    }
  }
  return copy;
}

/**
 * Sanitizes a single row (new/old record) before persistence.
 * Returns null for nullish/non-object inputs so callers can store a SQL NULL.
 */
export function sanitizeRow(record: unknown): Record<string, unknown> | null {
  if (record === null || record === undefined || typeof record !== "object") {
    return null;
  }
  return redactPII(record) as Record<string, unknown>;
}
