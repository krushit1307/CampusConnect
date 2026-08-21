import { supabase } from "@/utils/supabaseClient";

export interface BudgetItem {
  id: string;
  category: string;
  description: string;
  amount: number;
}

export interface BudgetSnapshot {
  id: string;
  event_id: string;
  version_hash: string;
  author_id: string;
  payload_json: BudgetItem[];
  is_final: boolean;
  created_at: string;
}

export async function saveBudgetSnapshot(
  eventId: string,
  userId: string,
  items: BudgetItem[],
  lastKnownTimestamp?: string
): Promise<BudgetSnapshot> {
  // 1. Fetch latest snapshot to check Optimistic Concurrency Control (OCC)
  const { data: latestSnapshots } = await supabase
    .from("event_budgets")
    .select("created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (latestSnapshots && latestSnapshots.length > 0) {
    const latestTimestamp = latestSnapshots[0].created_at;
    if (lastKnownTimestamp && new Date(latestTimestamp) > new Date(lastKnownTimestamp)) {
      throw new Error("The budget was modified by someone else. Please refresh.");
    }
  }

  // 2. Generate unique version hash
  const versionHash = crypto.randomUUID().substring(0, 8);

  // 3. Save new snapshot
  const { data, error } = await supabase
    .from("event_budgets")
    .insert({
      event_id: eventId,
      author_id: userId,
      version_hash: versionHash,
      payload_json: items,
      is_final: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data as BudgetSnapshot;
}

export async function fetchBudgetHistory(eventId: string): Promise<BudgetSnapshot[]> {
  const { data, error } = await supabase
    .from("event_budgets")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as BudgetSnapshot[];
}
