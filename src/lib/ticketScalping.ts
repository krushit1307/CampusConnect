export const FALLBACK_DEVICE_FINGERPRINT = "fallback-anonymous-id";

const DEVICE_FINGERPRINT_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

export function isHighDemandEvent(event: { is_high_demand?: boolean | null } | null | undefined) {
  return event?.is_high_demand === true;
}

/**
 * FingerprintJS visitor IDs are pseudonymous abuse-prevention signals. Never
 * send the hook's shared fallback value because it would rate-limit every
 * fingerprinting failure as one device.
 */
export function normalizeDeviceFingerprint(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  if (
    !normalized ||
    normalized === FALLBACK_DEVICE_FINGERPRINT ||
    !DEVICE_FINGERPRINT_PATTERN.test(normalized)
  ) {
    return null;
  }
  return normalized;
}
