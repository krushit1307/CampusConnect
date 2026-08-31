// =============================================================================
// Types: Hardware Self-Insurance Pool
// Issue: #5289 - Dynamic "Hardware Resource" Drone Liability Insurance Micro-Premiums
// Description: Risk tiers for hardware library assets, the per-booking micro-premium
// charged from a club's Stripe escrow, the university replacement pool ledger, and
// the settlement routed to purchasing when an asset is destroyed.
// =============================================================================

/** Risk bands used to price a booking. */
export type RiskTier = "LOW" | "MODERATE" | "HIGH" | "EXTREME";

/**
 * Asset categories the hardware library lends. Mirrors the categories in
 * `rfidHardwareCheckout` and adds the low-risk items the pool also covers.
 */
export type HardwareCategory =
  | "drone"
  | "camera"
  | "sensor_kit"
  | "vr_headset"
  | "microcontroller"
  | "power_station"
  | "projector"
  | "laptop";

/** Pricing inputs for one category. */
export interface RiskProfile {
  category: HardwareCategory;
  tier: RiskTier;
  /** Multiplier applied to the base rate. Drones cost more to insure than projectors. */
  riskMultiplier: number;
  rationale: string;
}

/** The subset of a hardware asset the premium calculation needs. */
export interface InsurableAsset {
  id: string;
  name: string;
  category: HardwareCategory | string;
  /** Replacement cost in USD, i.e. what the pool must cover if it is destroyed. */
  valuationUsd: number;
}

/** A priced, mandatory premium presented at checkout. */
export interface PremiumQuote {
  assetId: string;
  assetName: string;
  category: HardwareCategory;
  tier: RiskTier;
  riskMultiplier: number;
  valuationUsd: number;
  bookingHours: number;
  /** Multiplier for bookings longer than a day. */
  durationFactor: number;
  /** Premium before the floor and ceiling are applied. */
  rawPremiumUsd: number;
  /** What the club is actually charged. Non-refundable. */
  premiumUsd: number;
  /** True when the floor or ceiling moved the price. */
  clamped: boolean;
  refundable: false;
  explanation: string;
}

export type LedgerEntryType = "PREMIUM" | "REPLACEMENT_PAYOUT" | "SUBSIDY";

/** One movement in or out of the self-insurance pool. */
export interface PoolLedgerEntry {
  id: string;
  type: LedgerEntryType;
  /** Positive for inflows, negative for payouts. */
  amountUsd: number;
  assetId: string;
  /** Club charged for a premium, or credited department for a payout. */
  counterparty: string;
  bookingId?: string;
  claimId?: string;
  stripeTransferId?: string;
  occurredAt: string;
}

/** Aggregate pool position derived from the ledger. */
export interface PoolState {
  balanceUsd: number;
  premiumsCollectedUsd: number;
  payoutsIssuedUsd: number;
  subsidiesReceivedUsd: number;
  premiumCount: number;
  payoutCount: number;
}

export type ClaimDecision = "FULLY_FUNDED" | "PARTIALLY_FUNDED" | "DECLINED_INSOLVENT";

/** An admin's "Asset Destroyed" declaration, priced against the pool. */
export interface DestructionSettlement {
  assetId: string;
  assetName: string;
  /** Replacement cost being claimed. */
  claimedUsd: number;
  /** What the pool can actually route to purchasing right now. */
  payoutUsd: number;
  /** Claim minus payout; the university has to cover this from another budget. */
  shortfallUsd: number;
  decision: ClaimDecision;
  poolBalanceBeforeUsd: number;
  poolBalanceAfterUsd: number;
  /** Department receiving the funds to buy the replacement. */
  payeeDepartment: string;
  reason: string;
}
