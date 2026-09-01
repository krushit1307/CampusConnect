// =============================================================================
// Hardware Self-Insurance Micro-Premiums (#5289)
// Prices the mandatory per-booking premium for hardware library assets from their
// risk tier and replacement value, tracks the university replacement pool ledger,
// and settles an "Asset Destroyed" declaration against the pool's actual balance.
// =============================================================================

import {
  ClaimDecision,
  DestructionSettlement,
  HardwareCategory,
  InsurableAsset,
  LedgerEntryType,
  PoolLedgerEntry,
  PoolState,
  PremiumQuote,
  RiskProfile,
  RiskTier,
} from "../types/hardwareInsurance";

/**
 * Fraction of an asset's replacement value charged per booking day at a risk
 * multiplier of 1.0.
 *
 * Calibrated so the canonical case in #5289 — a $2,000 drone booked for a day at
 * the HIGH multiplier of 3.0 — prices at exactly $15.00.
 */
export const BASE_RATE_PER_DOLLAR = 0.0025;

/** A booking is never free to insure, and never priced like a deposit. */
export const MIN_PREMIUM_USD = 1;
export const MAX_PREMIUM_USD = 50;

/** Bookings under this length pay the single-day rate. */
export const STANDARD_BOOKING_HOURS = 24;

/** Each extra day adds this share of the day rate, capped by DURATION_FACTOR_CAP. */
export const EXTRA_DAY_SURCHARGE = 0.25;
export const DURATION_FACTOR_CAP = 2;

/**
 * Risk tiers for the hardware library.
 *
 * The multiplier encodes how often a category is actually destroyed rather than
 * how expensive it is — value is already priced in through the replacement cost.
 * A drone in the hands of an untrained freshman is a different actuarial animal
 * from a projector bolted to a cart.
 */
export const RISK_PROFILES: Record<HardwareCategory, RiskProfile> = {
  drone: {
    category: "drone",
    tier: "HIGH",
    riskMultiplier: 3,
    rationale: "Operator error is total loss: water landings and flyaways are unrecoverable.",
  },
  vr_headset: {
    category: "vr_headset",
    tier: "MODERATE",
    riskMultiplier: 1.8,
    rationale: "Dropped and swung into walls by users who cannot see the room.",
  },
  camera: {
    category: "camera",
    tier: "MODERATE",
    riskMultiplier: 1.6,
    rationale: "Portable and lens-fragile, but usually repairable rather than destroyed.",
  },
  power_station: {
    category: "power_station",
    tier: "MODERATE",
    riskMultiplier: 1.5,
    rationale: "Battery abuse and outdoor exposure carry a thermal write-off risk.",
  },
  sensor_kit: {
    category: "sensor_kit",
    tier: "LOW",
    riskMultiplier: 1.1,
    rationale: "Losses are typically individual components, not the kit.",
  },
  laptop: {
    category: "laptop",
    tier: "LOW",
    riskMultiplier: 1,
    rationale: "High value, low destruction rate; liquid damage is the main write-off.",
  },
  microcontroller: {
    category: "microcontroller",
    tier: "LOW",
    riskMultiplier: 0.8,
    rationale: "Cheap to replace and rarely destroyed beyond a shorted board.",
  },
  projector: {
    category: "projector",
    tier: "LOW",
    riskMultiplier: 0.5,
    rationale: "Cart-mounted and stationary; lamp wear is maintenance, not loss.",
  },
};

/**
 * Fallback for a category the library has not tiered yet.
 *
 * Deliberately priced at MODERATE rather than LOW: an untiered asset is an
 * unknown, and underpricing the pool is the failure mode that empties it.
 */
export const UNTIERED_PROFILE: RiskProfile = {
  category: "sensor_kit",
  tier: "MODERATE",
  riskMultiplier: 1.5,
  rationale: "Category not yet tiered; priced at the moderate default until it is.",
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

export function isKnownCategory(category: string): category is HardwareCategory {
  return Object.prototype.hasOwnProperty.call(RISK_PROFILES, category);
}

/** Risk profile for a category, falling back to the untiered default. */
export function resolveRiskProfile(category: string): RiskProfile {
  return isKnownCategory(category) ? RISK_PROFILES[category] : UNTIERED_PROFILE;
}

/** Every category the library prices, ordered from most to least risky. */
export function listRiskProfiles(): RiskProfile[] {
  return Object.values(RISK_PROFILES).sort((a, b) => b.riskMultiplier - a.riskMultiplier);
}

/**
 * Duration surcharge. A week-long booking is more exposed than an afternoon one,
 * but the premium is a micro-payment, so growth is capped rather than linear.
 */
export function computeDurationFactor(bookingHours: number): number {
  const hours = Number.isFinite(bookingHours) && bookingHours > 0 ? bookingHours : 0;
  if (hours <= STANDARD_BOOKING_HOURS) return 1;

  const extraDays = Math.ceil((hours - STANDARD_BOOKING_HOURS) / STANDARD_BOOKING_HOURS);
  return Math.min(1 + extraDays * EXTRA_DAY_SURCHARGE, DURATION_FACTOR_CAP);
}

/**
 * Prices the mandatory micro-premium for one booking.
 *
 * @param bookingHours - Booking length; anything up to a day pays the day rate.
 */
export function quotePremium(
  asset: InsurableAsset,
  bookingHours: number = STANDARD_BOOKING_HOURS,
): PremiumQuote {
  const profile = resolveRiskProfile(String(asset.category));
  const valuationUsd = Math.max(0, Number(asset.valuationUsd) || 0);
  const durationFactor = computeDurationFactor(bookingHours);

  const rawPremiumUsd = round2(
    valuationUsd * BASE_RATE_PER_DOLLAR * profile.riskMultiplier * durationFactor,
  );
  const premiumUsd = round2(Math.min(Math.max(rawPremiumUsd, MIN_PREMIUM_USD), MAX_PREMIUM_USD));

  return {
    assetId: asset.id,
    assetName: asset.name,
    category: profile.category,
    tier: profile.tier,
    riskMultiplier: profile.riskMultiplier,
    valuationUsd,
    bookingHours,
    durationFactor,
    rawPremiumUsd,
    premiumUsd,
    clamped: premiumUsd !== rawPremiumUsd,
    refundable: false,
    explanation:
      `${profile.tier} risk (×${profile.riskMultiplier}) on a $${valuationUsd} replacement value ` +
      `over ${bookingHours}h (×${durationFactor}) = $${premiumUsd.toFixed(2)}, non-refundable.`,
  };
}

/** Ledger entry for a premium debited from a club's Stripe escrow. */
export function buildPremiumEntry(params: {
  id: string;
  quote: PremiumQuote;
  clubId: string;
  bookingId: string;
  stripeTransferId?: string;
  occurredAt: string;
}): PoolLedgerEntry {
  return {
    id: params.id,
    type: "PREMIUM",
    amountUsd: params.quote.premiumUsd,
    assetId: params.quote.assetId,
    counterparty: params.clubId,
    bookingId: params.bookingId,
    stripeTransferId: params.stripeTransferId,
    occurredAt: params.occurredAt,
  };
}

/** Ledger entry for a replacement payout routed out to purchasing. */
export function buildPayoutEntry(params: {
  id: string;
  settlement: DestructionSettlement;
  claimId: string;
  stripeTransferId?: string;
  occurredAt: string;
}): PoolLedgerEntry {
  return {
    id: params.id,
    type: "REPLACEMENT_PAYOUT",
    // Stored negative so the balance is a plain sum over the ledger.
    amountUsd: -Math.abs(params.settlement.payoutUsd),
    assetId: params.settlement.assetId,
    counterparty: params.settlement.payeeDepartment,
    claimId: params.claimId,
    stripeTransferId: params.stripeTransferId,
    occurredAt: params.occurredAt,
  };
}

const signedAmount = (entry: PoolLedgerEntry): number => Number(entry.amountUsd) || 0;

const isType = (entry: PoolLedgerEntry, type: LedgerEntryType): boolean => entry.type === type;

/**
 * Derives the pool position from its ledger.
 *
 * The balance is never stored as a mutable column: a running total that drifts
 * from the movements behind it is how an insurance pool silently underwrites
 * claims it cannot pay.
 */
export function computePoolState(entries: PoolLedgerEntry[]): PoolState {
  const rows = Array.isArray(entries) ? entries : [];

  const premiums = rows.filter((entry) => isType(entry, "PREMIUM"));
  const payouts = rows.filter((entry) => isType(entry, "REPLACEMENT_PAYOUT"));
  const subsidies = rows.filter((entry) => isType(entry, "SUBSIDY"));

  const sum = (list: PoolLedgerEntry[]) =>
    round2(list.reduce((total, entry) => total + signedAmount(entry), 0));

  const premiumsCollectedUsd = sum(premiums);
  const subsidiesReceivedUsd = sum(subsidies);
  const payoutsIssuedUsd = round2(Math.abs(sum(payouts)));

  return {
    balanceUsd: round2(premiumsCollectedUsd + subsidiesReceivedUsd - payoutsIssuedUsd),
    premiumsCollectedUsd,
    payoutsIssuedUsd,
    subsidiesReceivedUsd,
    premiumCount: premiums.length,
    payoutCount: payouts.length,
  };
}

/**
 * Settles an "Asset Destroyed" declaration against the pool.
 *
 * Pays the replacement cost only as far as the pool's balance goes. Routing more
 * than the pool holds would overdraw a real Stripe balance and hide the shortfall
 * the university has to cover from another budget, so a short pool produces a
 * partial payout and an explicit shortfall instead of a silent overdraft.
 */
export function settleDestruction(params: {
  asset: InsurableAsset;
  ledger: PoolLedgerEntry[];
  payeeDepartment: string;
  /** Override when the claim is less than full replacement cost. */
  claimedUsd?: number;
}): DestructionSettlement {
  const { asset, ledger, payeeDepartment } = params;
  const poolState = computePoolState(ledger);
  const poolBalanceBeforeUsd = poolState.balanceUsd;

  const claimedUsd = round2(Math.max(0, Number(params.claimedUsd ?? asset.valuationUsd) || 0));
  const available = Math.max(0, poolBalanceBeforeUsd);
  const payoutUsd = round2(Math.min(claimedUsd, available));
  const shortfallUsd = round2(claimedUsd - payoutUsd);

  let decision: ClaimDecision;
  let reason: string;
  if (payoutUsd === 0 && claimedUsd > 0) {
    decision = "DECLINED_INSOLVENT";
    reason = `Pool balance is $${poolBalanceBeforeUsd.toFixed(2)}; no funds can be routed for ${asset.name}.`;
  } else if (shortfallUsd > 0) {
    decision = "PARTIALLY_FUNDED";
    reason =
      `Pool covered $${payoutUsd.toFixed(2)} of the $${claimedUsd.toFixed(2)} replacement cost for ` +
      `${asset.name}; $${shortfallUsd.toFixed(2)} must come from another budget.`;
  } else {
    decision = "FULLY_FUNDED";
    reason = `Replacement cost of $${payoutUsd.toFixed(2)} for ${asset.name} routed to ${payeeDepartment}.`;
  }

  return {
    assetId: asset.id,
    assetName: asset.name,
    claimedUsd,
    payoutUsd,
    shortfallUsd,
    decision,
    poolBalanceBeforeUsd,
    poolBalanceAfterUsd: round2(poolBalanceBeforeUsd - payoutUsd),
    payeeDepartment,
    reason,
  };
}

/** Number of like-for-like bookings needed to fund one replacement of an asset. */
export function bookingsToFundReplacement(asset: InsurableAsset): number {
  const premium = quotePremium(asset).premiumUsd;
  if (premium <= 0) return Infinity;
  return Math.ceil((Number(asset.valuationUsd) || 0) / premium);
}

export function formatUsd(amount: number): string {
  const value = Number(amount) || 0;
  return `$${value.toFixed(2)}`;
}

/** Tailwind text colour per risk tier, shared by the checkout and admin views. */
export const TIER_TEXT_CLASS: Record<RiskTier, string> = {
  LOW: "text-emerald-400",
  MODERATE: "text-amber-400",
  HIGH: "text-orange-400",
  EXTREME: "text-red-400",
};
