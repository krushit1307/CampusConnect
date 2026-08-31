export const REVOCATION_REASON_MAX_LENGTH = 1000;

export function normalizeRevocationReason(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > REVOCATION_REASON_MAX_LENGTH) return null;
  return normalized;
}

export function buildRevocationMessage(reason: string | null | undefined): string {
  return `REVOKED. This credential has been invalidated by the issuing organization due to: ${reason || "an issuer-reported integrity concern."}`;
}
