import { supabase } from "@/lib/supabase";

export interface AnalyticsRow {
  id: string;
  month: string | null;
  category: string | null;
  rsvp_count: number;
  updated_at: string;
}

export interface ParsedAnalytics {
  granular: { month: string; category: string; rsvpCount: number }[];
  monthlyTotals: { month: string; rsvpCount: number }[];
  grandTotal: number;
}

/**
 * Triggers the RPC function to update the cache in the database.
 */
export async function refreshAnalyticsCache(): Promise<void> {
  const { error } = await supabase.rpc("refresh_analytics_cache");
  if (error) {
    console.error("Failed to refresh analytics cache:", error);
    throw error;
  }
}

/**
 * Fetches cached rows and partitions ROLLUP output into distinct analytics tiers.
 */
export async function getAnalyticsData(): Promise<ParsedAnalytics> {
  const { data, error } = await supabase
    .from("analytics_cache")
    .select("*")
    .order("month", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("Error fetching analytics cache:", error);
    throw error;
  }

  const rows = (data || []) as AnalyticsRow[];

  const granular: ParsedAnalytics["granular"] = [];
  const monthlyTotals: ParsedAnalytics["monthlyTotals"] = [];
  let grandTotal = 0;

  for (const row of rows) {
    // 1. Grand Total Row (month IS NULL & category IS NULL)
    if (row.month === null && row.category === null) {
      grandTotal = Number(row.rsvp_count);
    }
    // 2. Monthly Subtotal Row (month IS NOT NULL & category IS NULL)
    else if (row.month !== null && row.category === null) {
      monthlyTotals.push({
        month: row.month,
        rsvpCount: Number(row.rsvp_count),
      });
    }
    // 3. Granular Category Row (month IS NOT NULL & category IS NOT NULL)
    else if (row.month !== null && row.category !== null) {
      granular.push({
        month: row.month,
        category: row.category,
        rsvpCount: Number(row.rsvp_count),
      });
    }
  }

  return {
    granular,
    monthlyTotals,
    grandTotal,
  };
}
