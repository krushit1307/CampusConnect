import { createClient } from "@/lib/supabase/client";

// =============================================================================
// Service: Event Budget Variance Report Service
// Issue: #4217 - Develop a 'Dynamic "Event Budget" Variance Report'
// =============================================================================

export interface CategoryVarianceRow {
  category: string;
  estimated: number;
  actual: number;
  variance: number;
  percentage_variance: number;
  is_overspent: boolean;
}

export interface EventBudgetVarianceReport {
  event_id: string;
  event_title: string;
  total_estimated: number;
  total_actual: number;
  total_variance: number;
  is_overspent: boolean;
  categories: CategoryVarianceRow[];
}

/**
 * Formats monetary amounts in standard currency representation.
 */
export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Calculates line-by-line category variance and overall totals.
 */
export function calculateBudgetVariances(
  estimates: Array<{ category: string; amount: number }>,
  actuals: Array<{ category: string; amount: number }>,
): EventBudgetVarianceReport {
  const categoryMap = new Map<string, { estimated: number; actual: number }>();

  for (const est of estimates) {
    const cat = est.category || "General";
    const current = categoryMap.get(cat) || { estimated: 0, actual: 0 };
    current.estimated += Number(est.amount) || 0;
    categoryMap.set(cat, current);
  }

  for (const act of actuals) {
    const cat = act.category || "General";
    const current = categoryMap.get(cat) || { estimated: 0, actual: 0 };
    current.actual += Number(act.amount) || 0;
    categoryMap.set(cat, current);
  }

  let total_estimated = 0;
  let total_actual = 0;
  const categories: CategoryVarianceRow[] = [];

  for (const [category, val] of categoryMap.entries()) {
    const estimated = Number(val.estimated.toFixed(2));
    const actual = Number(val.actual.toFixed(2));
    const variance = Number((estimated - actual).toFixed(2));
    const is_overspent = actual > estimated;
    const percentage_variance =
      estimated > 0 ? Number((((actual - estimated) / estimated) * 100).toFixed(1)) : 0;

    total_estimated += estimated;
    total_actual += actual;

    categories.push({
      category,
      estimated,
      actual,
      variance,
      percentage_variance,
      is_overspent,
    });
  }

  // Sort: Overspent first, then highest actuals
  categories.sort((a, b) => {
    if (a.is_overspent && !b.is_overspent) return -1;
    if (!a.is_overspent && b.is_overspent) return 1;
    return b.actual - a.actual;
  });

  const total_variance = Number((total_estimated - total_actual).toFixed(2));

  return {
    event_id: "",
    event_title: "",
    total_estimated: Number(total_estimated.toFixed(2)),
    total_actual: Number(total_actual.toFixed(2)),
    total_variance,
    is_overspent: total_actual > total_estimated,
    categories,
  };
}

/**
 * Fetches the event budget variance report from Supabase RPC.
 */
export async function getEventBudgetVarianceReport(
  eventId: string,
): Promise<EventBudgetVarianceReport | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_event_budget_variance_report", {
    p_event_id: eventId,
  });

  if (error) {
    console.error("Error fetching budget variance report:", error);
    return null;
  }

  return data as EventBudgetVarianceReport;
}
