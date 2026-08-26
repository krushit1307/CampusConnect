import { createClient } from "./supabase/client";

export interface RevenueSplitConfig {
  clubId: string;
  stripeAccountId: string;
  pct: number; // e.g. 60 for 60%
  isPrimary?: boolean;
}

export interface TransferSplitResult {
  clubId: string;
  stripeAccountId: string;
  pct: number;
  amountCents: number;
  isPrimary: boolean;
}

export interface RefundSplitResult {
  clubId: string;
  stripeAccountId: string;
  refundAmountCents: number;
}

/**
 * Senior Integer Cent Split Calculation Engine:
 * Programmatically divides net revenue in cents across multiple co-hosts.
 * Enforces integer flooring for base allocations and safely assigns any 1-cent penny rounding
 * remainder to the primary host so total sum matches netAmountCents exactly.
 */
export function calculateProportionalRevenueSplits(
  netAmountCents: number,
  configs: RevenueSplitConfig[],
): TransferSplitResult[] {
  if (!configs || configs.length === 0) return [];
  if (netAmountCents <= 0) {
    return configs.map((c) => ({
      clubId: c.clubId,
      stripeAccountId: c.stripeAccountId,
      pct: c.pct,
      amountCents: 0,
      isPrimary: c.isPrimary ?? false,
    }));
  }

  // Validate total percentage sum === 100
  const totalPct = configs.reduce((sum, c) => sum + c.pct, 0);
  if (Math.abs(totalPct - 100) > 0.01) {
    throw new Error(
      `Invalid revenue split configuration: Total percentage must equal 100% (received ${totalPct}%).`,
    );
  }

  // Calculate base floored integer cents per host
  const result: TransferSplitResult[] = configs.map((c) => {
    const rawCents = Math.floor((netAmountCents * c.pct) / 100);
    return {
      clubId: c.clubId,
      stripeAccountId: c.stripeAccountId,
      pct: c.pct,
      amountCents: rawCents,
      isPrimary: c.isPrimary ?? false,
    };
  });

  // Calculate penny rounding remainder
  const allocatedCents = result.reduce((sum, r) => sum + r.amountCents, 0);
  const remainderCents = netAmountCents - allocatedCents;

  // Assign remainder fraction (if any) to the primary host (or first host if none specified)
  if (remainderCents > 0) {
    const primaryIdx = result.findIndex((r) => r.isPrimary);
    const targetIdx = primaryIdx !== -1 ? primaryIdx : 0;
    result[targetIdx].amountCents += remainderCents;
  }

  return result;
}

/**
 * Proportional Refund Reversal Calculation Engine:
 * Calculates exact integer cent clawbacks for each Stripe Connect account when a refund occurs.
 */
export function calculateProportionalRefundSplits(
  originalSplits: TransferSplitResult[],
  refundAmountCents: number,
): RefundSplitResult[] {
  if (!originalSplits || originalSplits.length === 0 || refundAmountCents <= 0) return [];

  const totalOriginalCents = originalSplits.reduce((sum, s) => sum + s.amountCents, 0);
  if (totalOriginalCents === 0) {
    return originalSplits.map((s) => ({
      clubId: s.clubId,
      stripeAccountId: s.stripeAccountId,
      refundAmountCents: 0,
    }));
  }

  const result: RefundSplitResult[] = originalSplits.map((s) => {
    const rawRefund = Math.floor((refundAmountCents * s.amountCents) / totalOriginalCents);
    return {
      clubId: s.clubId,
      stripeAccountId: s.stripeAccountId,
      refundAmountCents: rawRefund,
    };
  });

  const allocatedRefund = result.reduce((sum, r) => sum + r.refundAmountCents, 0);
  const remainderRefund = refundAmountCents - allocatedRefund;

  if (remainderRefund > 0) {
    const primaryIdx = originalSplits.findIndex((s) => s.isPrimary);
    const targetIdx = primaryIdx !== -1 ? primaryIdx : 0;
    result[targetIdx].refundAmountCents += remainderRefund;
  }

  return result;
}

/**
 * Records a completed revenue split transaction to the audit logs via Supabase RPC.
 */
export async function recordRevenueSplitAudit(
  eventId: string,
  stripeChargeId: string,
  totalNetCents: number,
  transfers: TransferSplitResult[],
): Promise<{ success: boolean; auditId?: string; message: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("record_revenue_split_audit", {
    p_event_id: eventId,
    p_charge_id: stripeChargeId,
    p_total_net_cents: totalNetCents,
    p_transfers: transfers as unknown as Record<string, unknown>[],
  });

  if (error) {
    return { success: false, message: error.message };
  }

  const res = data?.[0];
  return {
    success: res?.success ?? false,
    auditId: res?.audit_id ?? undefined,
    message: res?.message ?? "Audit record saved.",
  };
}

/**
 * Formats audit summary metrics for dashboard display.
 */
export function formatRevenueSplitAuditSummary(transfers: TransferSplitResult[]): {
  totalDistributedFormatted: string;
  summaryLines: string[];
} {
  const totalCents = transfers.reduce((sum, t) => sum + t.amountCents, 0);
  const totalFormatted = `$${(totalCents / 100).toFixed(2)}`;

  const summaryLines = transfers.map((t) => {
    const amtFormatted = `$${(t.amountCents / 100).toFixed(2)}`;
    const role = t.isPrimary ? "Primary Host" : "Co-Host";
    return `${role} (${t.pct}%): ${amtFormatted} [${t.stripeAccountId}]`;
  });

  return {
    totalDistributedFormatted: totalFormatted,
    summaryLines,
  };
}
