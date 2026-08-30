import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DonorChurnPrediction } from "@/types/churn";

export function useDonorChurn(clubId: string | null) {
  const [predictions, setPredictions] = useState<DonorChurnPrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const supabase = createClient();

  const fetchPredictions = async () => {
    if (!clubId) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("donor_churn_predictions")
        .select(
          `
                    *,
                    profiles ( full_name, avatar_url )
                `,
        )
        .eq("club_id", clubId)
        .order("risk_score", { ascending: false });

      if (err) throw err;
      setPredictions(data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load donor churn predictions.");
    } finally {
      setIsLoading(false);
    }
  };

  const runChurnModeler = async () => {
    if (!clubId) return;
    setIsRefreshing(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke("donor-churn-modeler", {
        body: { club_id: clubId },
      });
      if (err) throw err;
      if (data?.error) throw new Error(data.error);

      await fetchPredictions();
      return data?.processed || 0;
    } catch (err: any) {
      setError(err.message || "Failed to trigger churn modeler.");
      throw err;
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPredictions();
  }, [clubId]);

  return {
    predictions,
    isLoading,
    error,
    isRefreshing,
    runChurnModeler,
    refresh: fetchPredictions,
  };
}
