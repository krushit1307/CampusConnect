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
  if (typeof btoa !== "undefined") {
    return btoa(payload);
  }
  return Buffer.from(payload, "utf-8").toString("base64");
}

/**
 * Decodes a base64 Relay cursor string back into created_at timestamp and id tuple.
 */
export function decodeRelayCursor(cursor: string): { createdAt: string; id: string } | null {
  if (!cursor) return null;
  try {
    const decoded =
      typeof atob !== "undefined" ? atob(cursor) : Buffer.from(cursor, "base64").toString("utf-8");
    const parts = decoded.split(",");
    if (parts.length < 2) return null;
    return {
      createdAt: parts[0],
      id: parts.slice(1).join(","),
    };
  } catch {
    return null;
  }
}
