/**
 * System Counters Service
 * Provides optimized access to table row counts without expensive COUNT(*) queries.
 */
import { createClient } from "../lib/supabase/client";

const supabase = createClient();
export interface SystemCount {
  table_name: "events" | "profiles" | "clubs";
  row_count: number;
  updated_at: string;
}

export const getSystemCounts = async (): Promise<SystemCount[]> => {
  const { data, error } = await supabase.rpc("get_system_counts");

  if (error) {
    console.error("Error fetching system counts:", error);
    throw new Error("Failed to retrieve system statistics");
  }

  return data || [];
};

export const getCountForTable = async (
  tableName: "events" | "profiles" | "clubs",
): Promise<number> => {
  const counts = await getSystemCounts();
  const target = counts.find((c) => c.table_name === tableName);
  return target?.row_count || 0;
};
