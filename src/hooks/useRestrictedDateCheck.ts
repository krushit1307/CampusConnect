import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type RestrictedDateCategory = "MIDTERMS" | "FINALS" | "READING_DAYS";

export interface RestrictedDateConflict {
  category: RestrictedDateCategory;
  title: string;
  start_date: string;
  end_date: string;
}

const CATEGORY_LABEL: Record<RestrictedDateCategory, string> = {
  FINALS: "Finals Week",
  MIDTERMS: "Midterms",
  READING_DAYS: "Reading Days",
};

/**
 * Checks a proposed event window against the restricted_dates table
 * (#3890) and returns a conflict, if any, plus a ready-to-render warning.
 */
export function useRestrictedDateCheck(startsAt: string, endsAt: string) {
  const [conflict, setConflict] = useState<RestrictedDateConflict | null>(null);

  useEffect(() => {
    if (!startsAt) {
      setConflict(null);
      return;
    }
    const supabase = createClient();
    let cancelled = false;

    supabase
      .rpc("get_restricted_date_conflict", {
        p_starts_at: new Date(startsAt).toISOString(),
        p_ends_at: new Date(endsAt || startsAt).toISOString(),
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data || data.length === 0) {
          setConflict(null);
          return;
        }
        setConflict(data[0]);
      });

    return () => {
      cancelled = true;
    };
  }, [startsAt, endsAt]);

  const warningMessage = conflict
    ? `WARNING: You are scheduling this during ${CATEGORY_LABEL[conflict.category]}. Historically, attendance drops by 70% during this period. Are you sure?`
    : null;

  return { conflict, warningMessage };
}