import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_by: string;
  created_at: string;
}

/**
 * Custom hook to fetch paginated audit logs from the database.
 * @param page - Current page number (1-indexed)
 * @param pageSize - Number of logs per page
 */
export function useAuditLogs(page = 1, pageSize = 50) {
  return useQuery({
    queryKey: ["audit-logs", page, pageSize],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { logs: data as AuditLog[], count: count || 0 };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes cache
  });
}
