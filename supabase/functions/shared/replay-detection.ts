/**
 * Shared helpers for token-replay detection.
 *
 * A session is bound to two context dimensions at mint time:
 *   * the browser fingerprint hash, and
 *   * the /24 IP subnet hash.
 * Requests presenting the same JWT are compared against that binding.
 * Confirmed mismatches are treated as token replay (the token was
 * exfiltrated and is being presented from a different device/network).
 *
 * Raw fingerprints and raw IP addresses are never stored or logged —
 * only HMAC-SHA256 digests keyed with REPLAY_BINDING_SECRET.
 */

const FALLBACK_FINGERPRINTS = new Set([
  "fallback-anonymous-id",
  "",
  "unknown",
  "null",
  "undefined",
]);

/** Validates + normalizes a fingerprint value before it is hashed. */
export function normalizeFingerprint(value: unknown): string | null {
  if (typeof value !== "string") return null;
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

/** Extracts the client IP from the standard proxy header chain. */
export function getRequestIp(req: Request): string | null {
  const candidates = [
    req.headers.get("cf-connecting-ip"),
    req.headers.get("x-real-ip"),
    req.headers.get("x-forwarded-for")?.split(",")[0],
  ];
  const value = candidates.find((candidate) => candidate?.trim());
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length <= 128 ? normalized : null;
}

/**
 * Reduces an IP to its network prefix:
 *   * IPv4 -> /24 subnet (the campus subnet boundary)
 *   * IPv6 -> /64 subnet
 */
export function getIpSubnet(ip: string): string | null {
  const trimmed = ip.trim();
  if (!trimmed) return null;

  // IPv6 (contains a colon) -> /64 prefix.
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");
    const kept = parts.slice(0, 4);
    const subnet = `${kept.join(":")}::/64`;
    return subnet.length <= 128 ? subnet : null;
  }

  // IPv4 -> /24 prefix.
  const octets = trimmed.split(".");
  if (octets.length !== 4) return null;
  if (octets.some((octet) => !/^\d{1,3}$/.test(octet) || Number(octet) > 255)) return null;
  return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
}

/** HMAC-SHA256 hex digest. Returns null when the secret is unusable. */
export async function hmacHex(value: string, secret: string): Promise<string | null> {
  if (!secret || secret.length < 16) return null;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
    return Array.from(new Uint8Array(signature))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

/** Reads the validated fingerprint from the request headers/body. */
export function getFingerprintFromRequest(
  req: Request,
  body: Record<string, unknown>,
): string | null {
  return normalizeFingerprint(req.headers.get("x-device-fingerprint") ?? body.deviceFingerprint);
}
