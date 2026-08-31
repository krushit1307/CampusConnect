import type { SupabaseClient } from "@supabase/supabase-js";

export interface ApplyForLoanResult {
  success: boolean;
  message?: string;
  loan_id?: string;
  locked_auction_points?: number;
  total_owed_points?: number;
}

/** Applies for a Resource Loan from the Student Union Bank on behalf of a club. */
export async function applyForPointLoan(
  supabase: SupabaseClient,
  clubId: string,
): Promise<ApplyForLoanResult> {
  const { data, error } = await supabase.rpc("apply_for_point_loan", { p_club_id: clubId });
  if (error) throw new Error(error.message);
  return data as ApplyForLoanResult;
}

/** Fetches the club's currently active point loan, if any. */
export async function fetchActivePointLoan(supabase: SupabaseClient, clubId: string) {
  const { data, error } = await supabase
    .from("point_loans")
    .select("*")
    .eq("club_id", clubId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}