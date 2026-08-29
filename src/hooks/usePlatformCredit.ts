// =============================================================================
// Hook: usePlatformCredit
// Issue: #4522 - Automated "Event Cancellation" Credit Issuance
// Description: Provides reactive state for user platform balances, credit ledger,
// pending cancellation refund claims, and action handlers for choosing refund options.
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import {
  getUserPlatformBalance,
  getPlatformCreditLedger,
  getPendingCancellationClaims,
  resolveRefundChoice,
  calculateCancellationCredit,
} from "../services/platformCreditService";
import type {
  UserPlatformBalance,
  PlatformCreditLedgerEntry,
  CancellationRefundClaim,
  RefundChoiceResult,
  RefundOptionChoice,
} from "../types/platformCredit";

export interface UsePlatformCreditReturn {
  balance: UserPlatformBalance | null;
  balanceDollars: number;
  ledger: PlatformCreditLedgerEntry[];
  pendingClaims: CancellationRefundClaim[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  resolveClaim: (
    claimId: string,
    choice: RefundOptionChoice,
  ) => Promise<RefundChoiceResult>;
  calculateBonus: (amountCents: number, bonusPercentage?: number) => {
    originalAmountCents: number;
    bonusPercentage: number;
    bonusAmountCents: number;
    creditAmountCents: number;
  };
}

export function usePlatformCredit(userId?: string): UsePlatformCreditReturn {
  const [balance, setBalance] = useState<UserPlatformBalance | null>(null);
  const [ledger, setLedger] = useState<PlatformCreditLedgerEntry[]>([]);
  const [pendingClaims, setPendingClaims] = useState<CancellationRefundClaim[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCreditData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [balanceRes, ledgerRes, claimsRes] = await Promise.all([
        getUserPlatformBalance(userId),
        getPlatformCreditLedger(userId),
        getPendingCancellationClaims(userId),
      ]);

      setBalance(balanceRes);
      setLedger(ledgerRes);
      setPendingClaims(claimsRes);
    } catch (err: any) {
      console.error("[usePlatformCredit] Fetch error:", err);
      setError(err.message || "Failed to load platform credit information");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchCreditData();
  }, [fetchCreditData]);

  const handleResolveClaim = async (
    claimId: string,
    choice: RefundOptionChoice,
  ): Promise<RefundChoiceResult> => {
    try {
      const result = await resolveRefundChoice(claimId, choice);
      if (result.success) {
        // Optimistically remove claim from pending claims list
        setPendingClaims((prev) => prev.filter((c) => c.id !== claimId));

        if (choice === "credit" && result.new_balance_cents !== undefined) {
          setBalance((prev) =>
            prev
              ? {
                  ...prev,
                  balance_cents: result.new_balance_cents!,
                  lifetime_credited_cents:
                    prev.lifetime_credited_cents + (result.credit_amount_cents || 0),
                  bonus_earned_cents:
                    prev.bonus_earned_cents + (result.bonus_amount_cents || 0),
                }
              : null,
          );
        }

        // Trigger background refresh for ledger accuracy
        void fetchCreditData();
      }
      return result;
    } catch (err: any) {
      console.error("[usePlatformCredit] resolve error:", err);
      return {
        success: false,
        choice,
        error: err.message || "Failed to resolve refund claim",
      };
    }
  };

  const balanceDollars = balance ? balance.balance_cents / 100 : 0;

  return {
    balance,
    balanceDollars,
    ledger,
    pendingClaims,
    isLoading,
    error,
    refresh: fetchCreditData,
    resolveClaim: handleResolveClaim,
    calculateBonus: calculateCancellationCredit,
  };
}
