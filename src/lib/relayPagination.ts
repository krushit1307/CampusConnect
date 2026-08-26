/**
 * Relay-style pagination types and cursor encoding/decoding utilities.
 * Follows the GraphQL Relay Cursor Connections Specification.
 */

export interface RelayEdge<T> {
  cursor: string;
  node: T;
}

export interface RelayPageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

export interface RelayConnection<T> {
  edges: RelayEdge<T>[];
  pageInfo: RelayPageInfo;
}

/**
 * Encodes a tuple (e.g. timestamp, id) into a base64 Relay cursor string.
 */
export function encodeRelayCursor(createdAt: string, id: string): string {
  const payload = `${createdAt},${id}`;

  const base64 =
    typeof btoa !== "undefined"
      ? btoa(unescape(encodeURIComponent(payload)))
      : Buffer.from(payload, "utf-8").toString("base64");

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
/**
 * Decodes a base64 Relay cursor string back into created_at timestamp and id tuple.
 */
export function decodeRelayCursor(cursor: string): { createdAt: string; id: string } | null {
  if (!cursor) return null;

  try {
    const normalized = cursor.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);

    const decoded =
      typeof atob !== "undefined"
        ? decodeURIComponent(escape(atob(padded)))
        : Buffer.from(padded, "base64").toString("utf-8");

    const parts = decoded.split(",");

    if (parts.length < 2 || !parts[0] || !parts[1]) {
      return null;
    }

    return {
      createdAt: parts[0],
      id: parts.slice(1).join(","),
    };
  } catch {
    return null;
  }
}