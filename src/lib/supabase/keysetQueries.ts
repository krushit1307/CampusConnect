// =============================================================================
// Utility: Keyset (Cursor) Pagination Query Builder
// Issue: #2734 - Implement Data Pagination using Keyset Pagination (Cursor-based)
// Description: Replaces slow OFFSET/LIMIT queries with highly optimized
// cursor-based WHERE clauses. Uses compound indexes on (created_at, id)
// to guarantee deterministic ordering and prevent duplicate items during
// real - time inserts.
// =============================================================================

import { supabase } from "./supabaseClient";
import { PostgrestQueryBuilder } from "@supabase/postgrest-js";

export interface CursorParams {
  cursorCreatedAt?: string; // ISO8601 timestamp of the last item
  cursorId?: string; // UUID of the last item (tie-breaker)
  limit?: number; // Page size (default 20)
  orderDirection?: "asc" | "desc"; // Sort direction
}

export interface FilterParams {
  clubId?: string;
  status?: string;
  searchQuery?: string;
}

/**
 * Builds and executes a keyset-paginated query for the events table.
 *
 * @param cursor - The cursor parameters from the previous page
 * @param filters - Optional filters to apply
 * @returns The fetched page of data and the cursor for the next page
 */
export async function fetchEventsKeyset(cursor: CursorParams = {}, filters: FilterParams = {}) {
  const { cursorCreatedAt, cursorId, limit = 12, orderDirection = "desc" } = cursor;

  // Start building the query
  let query = supabase.from("events").select(
    `
      *,
      club:clubs (name, logo_url),
      creator:profiles!created_by (full_name, avatar_url)
    `,
    { count: "estimated" },
  ); // Use estimated count for performance on massive tables

  // Apply Filters
  if (filters.clubId) {
    query = query.eq("club_id", filters.clubId);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.searchQuery) {
    query = query.ilike("title", `%${filters.searchQuery}%`);
  }

  // Apply Keyset Cursor Logic
  // This is the core of cursor pagination. Instead of OFFSET 100, we say:
  // "Give me rows WHERE (created_at, id) is strictly LESS THAN the last seen row"
  if (cursorCreatedAt && cursorId) {
    if (orderDirection === "desc") {
      // For DESC order, we want rows OLDER than the cursor
      // (created_at < cursor_time) OR (created_at = cursor_time AND id < cursor_id)
      query = query.or(
        `created_at.lt.${cursorCreatedAt},` +
          `and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`,
      );
    } else {
      // For ASC order, we want rows NEWER than the cursor
      query = query.or(
        `created_at.gt.${cursorCreatedAt},` +
          `and(created_at.eq.${cursorCreatedAt},id.gt.${cursorId})`,
      );
    }
  }

  // Apply Ordering (Must match the compound index!)
  query = query.order("created_at", { ascending: orderDirection === "asc" });
  query = query.order("id", { ascending: orderDirection === "asc" });

  // Apply Limit
  query = query.limit(limit);

  // Execute Query
  const { data, error, count } = await query;

  if (error) {
    console.error("[KeysetQuery] Fetch failed:", error);
    throw error;
  }

  // Determine the cursor for the NEXT page
  // It's simply the last item in the current result set
  let nextCursor: CursorParams | null = null;
  if (data && data.length === limit) {
    const lastItem = data[data.length - 1];
    nextCursor = {
      cursorCreatedAt: lastItem.created_at,
      cursorId: lastItem.id,
      limit,
      orderDirection,
    };
  }

  return {
    data: data || [],
    nextCursor,
    estimatedTotal: count || 0,
  };
}

/**
 * Helper to extract the cursor from a TanStack Query page
 */
export function extractCursorFromPage(page: any): CursorParams | null {
  return page.nextCursor;
}
