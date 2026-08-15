import { useInfiniteQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

// =============================================================================
// Hook: useAuditLogs
// Issue: #2727 - Implement a Unified Audit Log of all Admin Actions
// Description: Fetches and manages the state of the audit log feed for the
// Club Admin Dashboard. Supports filtering by table, action type, and actor.
// Uses InfiniteQuery for efficient "load more" pagination.
// =============================================================================

const supabase = createClient();
const PAGE_SIZE = 50;

export interface AuditLogEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  actor_id: string | null;
  timestamp: string;
  actor_profile?: {
    full_name: string;
    avatar_url: string;
  } | null;
}

export interface AuditFilters {
  tableName?: string;
  action?: string;
  actorId?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Custom hook to fetch paginated & filtered audit logs using Infinite Query.
 * @param clubId - The current club context (used for RLS / explicit filtering)
 * @param filters - Optional filter parameters for the audit log query
 */
export function useAuditLogs(clubId: string, filters: AuditFilters = {}) {
  return useInfiniteQuery({
    queryKey: ["audit-logs", clubId, filters],
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      // If we received fewer items than PAGE_SIZE, there are no more pages
      if (lastPage.length < PAGE_SIZE) return undefined;
      return lastPageParam + 1;
    },
    queryFn: async ({ pageParam }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("audit_logs")
        .select(
          `
          *,
          actor_profile:profiles!actor_id(full_name, avatar_url)
        `,
          { count: "exact" },
        )
        .order("timestamp", { ascending: false })
        .range(from, to);

      // Apply dynamic filters
      if (filters.tableName) {
        query = query.eq("table_name", filters.tableName);
      }
      if (filters.action) {
        query = query.eq("action", filters.action);
      }
      if (filters.actorId) {
        query = query.eq("actor_id", filters.actorId);
      }
      if (filters.startDate) {
        query = query.gte("timestamp", filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte("timestamp", filters.endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((log) => ({
        ...log,
        actor_profile: log.actor_profile as AuditLogEntry["actor_profile"],
      })) as AuditLogEntry[];
    },
    staleTime: 1000 * 60 * 2, // 2 minutes cache
  });
}
