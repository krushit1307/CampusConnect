const FALLBACK_FINGERPRINTS = new Set(["fallback-anonymous-id", "", "unknown", "null"]);

export function normalizeShadowbanFingerprint(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (
    normalized.length < 16 ||
    normalized.length > 256 ||
    FALLBACK_FINGERPRINTS.has(normalized.toLowerCase()) ||
    !/^[a-zA-Z0-9._:-]+$/.test(normalized)
  ) {
    return null;
  }
  return normalized;
}
