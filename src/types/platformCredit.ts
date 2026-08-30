// =============================================================================
// Type Definitions: Platform Credit, Internal Ledger & Cancellation Claims
// Issue: #4522 - Automated "Event Cancellation" Credit Issuance
// =============================================================================

export interface UserPlatformBalance {
  user_id: string;
  balance_cents: number;
  lifetime_credited_cents: number;
  lifetime_spent_cents: number;
  bonus_earned_cents: number;
  updated_at: string;
}

export type PlatformCreditTransactionType =
  | "cancellation_credit"
  | "checkout_deduction"
  | "refund_payout"
  | "admin_adjustment"
  | "credit_bonus";

export interface PlatformCreditLedgerEntry {
  id: string;
  user_id: string;
  amount_cents: number;
  balance_after_cents: number;
  transaction_type: PlatformCreditTransactionType;
  description: string;
  reference_id?: string | null;
  bonus_amount_cents: number;
  metadata?: Record<string, any>;
  created_at: string;
}

export type CancellationClaimStatus =
  | "pending_choice"
  | "credit_issued"
  | "card_refunded"
  | "expired";

export type RefundOptionChoice = "card" | "credit";

export interface CancellationRefundClaim {
  id: string;
  event_id: string;
  rsvp_id: string;
  user_id: string;
  original_amount_cents: number;
  bonus_percentage: number;
  credit_amount_cents: number;
  status: CancellationClaimStatus;
  selected_option?: RefundOptionChoice | null;
  stripe_refund_id?: string | null;
  expires_at?: string | null;
  resolved_at?: string | null;
  created_at: string;
  event_title?: string;
}

export interface RefundChoiceResult {
  success: boolean;
  choice: RefundOptionChoice;
  credit_amount_cents?: number;
  bonus_amount_cents?: number;
  new_balance_cents?: number;
  stripe_refund_id?: string | null;
  message?: string;
  error?: string;
}

export interface CheckoutCreditApplication {
  credit_applied_cents: number;
  remaining_amount_cents: number;
  new_balance_cents: number;
  fully_covered: boolean;
}
