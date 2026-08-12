/**
 * Extracts the `session_id` claim from a Supabase access-token JWT.
 * This links a device session to its underlying `auth.sessions` row
 * so it can be remotely revoked.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

  try {
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getSessionIdFromToken(token: string): string | null {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.session_id !== "string") {
    return null;
  }
  return payload.session_id;
}
