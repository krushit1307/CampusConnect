// =============================================================================
// Service: PlatformCreditService
// Issue: #4522 - Automated "Event Cancellation" Credit Issuance
// Description: Manages user platform credit balances, immutable audit ledger
// transactions, cancellation refund claims, and automated checkout deductions.
// =============================================================================

import { createClient } from "../lib/supabase/client";
import type {
  UserPlatformBalance,
  PlatformCreditLedgerEntry,
  CancellationRefundClaim,
  RefundChoiceResult,
  RefundOptionChoice,
  CheckoutCreditApplication,
} from "../types/platformCredit";

export const DEFAULT_CANCELLATION_BONUS_PERCENTAGE = 10;

/**
 * Calculates platform credit with bonus percentage for event cancellation.
 * E.g., $50.00 (5000 cents) + 10% bonus = $55.00 (5500 cents).
 */
export function calculateCancellationCredit(
  originalAmountCents: number,
  bonusPercentage: number = DEFAULT_CANCELLATION_BONUS_PERCENTAGE,
): {
  originalAmountCents: number;
  bonusPercentage: number;
  bonusAmountCents: number;
  creditAmountCents: number;
} {
  const safeOriginal = Math.max(0, Math.round(originalAmountCents));
  const safeBonusPct = Math.max(0, bonusPercentage);
  const bonusAmountCents = Math.round(safeOriginal * (safeBonusPct / 100));
  const creditAmountCents = safeOriginal + bonusAmountCents;

  return {
    originalAmountCents: safeOriginal,
    bonusPercentage: safeBonusPct,
    bonusAmountCents,
    creditAmountCents,
  };
}

/**
 * Fetches the user's current platform credit balance.
 */
export async function getUserPlatformBalance(
  userId?: string,
): Promise<UserPlatformBalance> {
  const supabase = createClient();
  let targetUserId = userId;

  if (!targetUserId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return {
        user_id: "",
        balance_cents: 0,
        lifetime_credited_cents: 0,
        lifetime_spent_cents: 0,
        bonus_earned_cents: 0,
        updated_at: new Date().toISOString(),
      };
    }
    targetUserId = user.id;
  }

  const { data, error } = await supabase
    .from("user_platform_balances")
    .select("*")
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (error || !data) {
    return {
      user_id: targetUserId,
      balance_cents: 0,
      lifetime_credited_cents: 0,
      lifetime_spent_cents: 0,
      bonus_earned_cents: 0,
      updated_at: new Date().toISOString(),
    };
  }

  return data as UserPlatformBalance;
}

/**
 * Fetches the chronological ledger of user platform credit transactions.
 */
export async function getPlatformCreditLedger(
  userId?: string,
): Promise<PlatformCreditLedgerEntry[]> {
  const supabase = createClient();
  let targetUserId = userId;

  if (!targetUserId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    targetUserId = user.id;
  }

  const { data, error } = await supabase
    .from("user_platform_credit_ledger")
    .select("*")
    .eq("user_id", targetUserId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data as PlatformCreditLedgerEntry[];
}

/**
 * Fetches pending cancellation refund claims for the current user.
 */
export async function getPendingCancellationClaims(
  userId?: string,
): Promise<CancellationRefundClaim[]> {
  const supabase = createClient();
  let targetUserId = userId;

  if (!targetUserId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    targetUserId = user.id;
  }

  const { data, error } = await supabase
    .from("cancellation_refund_claims")
    .select("*, events(title)")
    .eq("user_id", targetUserId)
    .eq("status", "pending_choice")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((item: any) => ({
    ...item,
    event_title: item.events?.title || "Cancelled Event",
  })) as CancellationRefundClaim[];
}

/**
 * Resolves a cancellation refund claim by choosing either:
 * - 'credit': Atomically issues platform credit with 10% bonus without calling Stripe.
 * - 'card': Executes Stripe card refund.
 */
export async function resolveRefundChoice(
  claimId: string,
  choice: RefundOptionChoice,
): Promise<RefundChoiceResult> {
  const supabase = createClient();

  // Call the Edge Function first
  const { data, error } = await supabase.functions.invoke("process-refund-choice", {
    body: { claimId, choice },
  });

  if (error || !data?.success) {
    // Fallback: direct RPC invocation if edge function unavailable in local test env
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return {
        success: false,
        choice,
        error: error?.message || "User is not authenticated",
      };
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "process_cancellation_refund_choice",
      {
        p_claim_id: claimId,
        p_user_id: user.id,
        p_choice: choice,
      },
    );

    if (rpcError) {
      return {
        success: false,
        choice,
        error: rpcError.message || "Failed to process refund choice",
      };
    }

    return (rpcData || { success: true, choice }) as RefundChoiceResult;
  }

  return data as RefundChoiceResult;
}

/**
 * Automatically applies platform credit to checkout prior to charging a credit card.
 */
export async function applyCreditToCheckout(
  userId: string,
  orderAmountCents: number,
  orderId: string,
  description?: string,
): Promise<CheckoutCreditApplication> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("apply_platform_credit_to_checkout", {
    p_user_id: userId,
    p_order_amount_cents: orderAmountCents,
    p_order_id: orderId,
    p_description: description || `Checkout credit deduction for order ${orderId}`,
  });

  if (error || !data) {
    console.error("[platformCreditService] Failed to apply platform credit:", error);
    return {
      credit_applied_cents: 0,
      remaining_amount_cents: orderAmountCents,
      new_balance_cents: 0,
      fully_covered: false,
    };
  }

  return data as CheckoutCreditApplication;
}
