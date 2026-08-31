// =============================================================================
// Hook: useReimbursements
// Issue: #3227 - Implement 'Automated Reimbursement Processing' via Stripe
// Description: Manages the lifecycle of expense reimbursements.Handles
// fetching requests, submitting new claims with receipt uploads, and
// executing the approval workflow(including dual - approval logic).
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";

export interface Reimbursement {
  id: string;
  club_id: string;
  user_id: string;
  amount_cents: number;
  currency: string;
  description: string;
  receipt_url: string;
  status: "pending" | "approved_treasurer" | "approved_dual" | "processing" | "paid" | "rejected";
  treasurer_approval_id: string | null;
  president_approval_id: string | null;
  stripe_transfer_id: string | null;
  failure_reason: string | null;
  created_at: string;
  profiles?: { full_name: string; avatar_url: string | null };
}

interface UseReimbursementsReturn {
  reimbursements: Reimbursement[];
  isLoading: boolean;
  error: string | null;
  submitReimbursement: (
    clubId: string,
    amount: number,
    description: string,
    receiptFile: File,
  ) => Promise<boolean>;
  approveReimbursement: (id: string, role: "treasurer" | "president") => Promise<boolean>;
  rejectReimbursement: (id: string) => Promise<boolean>;
  triggerPayout: (id: string) => Promise<boolean>;
  triggerPayoutWithBiometrics: (
    id: string,
    startAuth: (options: any) => Promise<any>,
  ) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useReimbursements(clubId: string | null): UseReimbursementsReturn {
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReimbursements = useCallback(async () => {
    if (!clubId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("expense_reimbursements")
        .select(
          `
          *,
          profiles:user_id (full_name, avatar_url)
        `,
        )
        .eq("club_id", clubId)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setReimbursements((data as Reimbursement[]) || []);
    } catch (err: any) {
      console.error("[useReimbursements] Fetch failed:", err);
      setError(err.message || "Failed to load reimbursements.");
    } finally {
      setIsLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    fetchReimbursements();
  }, [fetchReimbursements]);

  const submitReimbursement = async (
    clubId: string,
    amount: number,
    description: string,
    receiptFile: File,
  ): Promise<boolean> => {
    setError(null);
    try {
      // 1. Upload receipt to storage
      const fileExt = receiptFile.name.split(".").pop() || "jpg";
      const fileName = `${clubId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `reimbursements/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("club-finance-docs")
        .upload(filePath, receiptFile, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("club-finance-docs").getPublicUrl(filePath);

      // 2. Insert reimbursement record
      const amountCents = Math.round(amount * 100);
      const { error: insertError } = await supabase.from("expense_reimbursements").insert({
        club_id: clubId,
        amount_cents: amountCents,
        description,
        receipt_url: publicUrl,
        status: "pending",
      });

      if (insertError) throw insertError;

      await fetchReimbursements();
      return true;
    } catch (err: any) {
      console.error("[useReimbursements] Submit failed:", err);
      setError(err.message || "Failed to submit reimbursement.");
      return false;
    }
  };

  const approveReimbursement = async (
    id: string,
    role: "treasurer" | "president",
  ): Promise<boolean> => {
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const updatePayload: any = { updated_at: new Date().toISOString() };

      if (role === "treasurer") {
        updatePayload.treasurer_approval_id = user.id;
        updatePayload.treasurer_approved_at = new Date().toISOString();
      } else {
        updatePayload.president_approval_id = user.id;
        updatePayload.president_approved_at = new Date().toISOString();
      }

      // We need to check if both are approved to set the final status
      const { data: current } = await supabase
        .from("expense_reimbursements")
        .select("amount_cents, treasurer_approval_id, president_approval_id")
        .eq("id", id)
        .single();

      if (!current) throw new Error("Reimbursement not found");

      const requiresDual = current.amount_cents > 10000;
      const hasTreasurer = role === "treasurer" || !!current.treasurer_approval_id;
      const hasPresident = role === "president" || !!current.president_approval_id;

      if (requiresDual && hasTreasurer && hasPresident) {
        updatePayload.status = "approved_dual";
      } else if (!requiresDual && hasTreasurer) {
        updatePayload.status = "approved_treasurer";
      } else {
        // Partial approval state, keep status pending or update to reflect partial
        updatePayload.status = "pending";
      }

      const { error: updateError } = await supabase
        .from("expense_reimbursements")
        .update(updatePayload)
        .eq("id", id);

      if (updateError) throw updateError;

      await fetchReimbursements();
      return true;
    } catch (err: any) {
      console.error("[useReimbursements] Approve failed:", err);
      setError(err.message);
      return false;
    }
  };

  const rejectReimbursement = async (id: string): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from("expense_reimbursements")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", id);

      if (updateError) throw updateError;
      await fetchReimbursements();
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  };

  const triggerPayout = async (id: string): Promise<boolean> => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke("process-reimbursement", {
        body: { reimbursement_id: id },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      await fetchReimbursements();
      return true;
    } catch (err: any) {
      console.error("[useReimbursements] Payout failed:", err);
      setError(err.message || "Failed to trigger payout.");
      return false;
    }
  };

  const triggerPayoutWithBiometrics = async (
    id: string,
    startAuth: (options: any) => Promise<any>,
  ): Promise<boolean> => {
    try {
      const { data: options, error: challengeErr } = await supabase.functions.invoke(
        "governance-action",
        {
          body: {
            action: "generate-challenge",
            actionType: "treasury_transfer",
            payload: { reimbursementId: id },
          },
        },
      );
      if (challengeErr) throw challengeErr;
      if (options?.error) throw new Error(options.error);

      const authenticationResponse = await startAuth(options);

      const { data: execData, error: execErr } = await supabase.functions.invoke(
        "governance-action",
        {
          body: {
            action: "execute",
            authenticationResponse,
          },
        },
      );

      if (execErr) throw execErr;
      if (execData?.error) throw new Error(execData.error);

      await fetchReimbursements();
      return true;
    } catch (err: any) {
      setError(err.message || "Failed to authorize and trigger payout.");
      return false;
    }
  };

  return {
    reimbursements,
    isLoading,
    error,
    submitReimbursement,
    approveReimbursement,
    rejectReimbursement,
    triggerPayout,
    triggerPayoutWithBiometrics,
    refresh: fetchReimbursements,
  };
}
