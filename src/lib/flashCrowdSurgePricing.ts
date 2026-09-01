export interface EventDemandMetrics {
  eventId: string;
  basePriceCents: number;
  remainingTickets: number;
  activeCheckoutViewers: number;
  surgeEnabled?: boolean;
}

export interface SurgePricingEvaluationResult {
  eventId: string;
  demandRatio: number;
  isSurgeActive: boolean;
  surgeMultiplier: number;
  originalPriceCents: number;
  finalPriceCents: number;
  warningNotice: string | null;
}

export const SURGE_ACTIVATION_THRESHOLD_RATIO = 5.0;

/**
 * Calculates demand ratio and dynamic surge pricing multiplier for high-demand ticket sales.
 */
export function calculateSurgeMultiplier(
  activeViewers: number,
  remainingInventory: number,
): { demandRatio: number; multiplier: number; isSurge: boolean } {
  if (remainingInventory <= 0) {
    return { demandRatio: Infinity, multiplier: 2.0, isSurge: true };
  }

  const demandRatio = Number((activeViewers / remainingInventory).toFixed(2));

  if (demandRatio < SURGE_ACTIVATION_THRESHOLD_RATIO) {
    return { demandRatio, multiplier: 1.0, isSurge: false };
  }

  let multiplier = 1.5; // Base 1.5x surge for ratio >= 5.0
  if (demandRatio >= 20.0) {
    multiplier = 2.0; // 2.0x for extreme spikes (e.g. 5000 viewers / 100 tickets)
  } else if (demandRatio >= 10.0) {
    multiplier = 1.75;
  }

  return {
    demandRatio,
    multiplier,
    isSurge: true,
  };
}

/**
 * Evaluates ticket pricing state, dynamically computes Stripe unit amount, and returns UI banner warning.
 */
export function evaluateEventSurgePricing(
  metrics: EventDemandMetrics,
): SurgePricingEvaluationResult {
  if (metrics.surgeEnabled === false) {
    return {
      eventId: metrics.eventId,
      demandRatio: Number(
        (metrics.activeCheckoutViewers / Math.max(1, metrics.remainingTickets)).toFixed(2),
      ),
      isSurgeActive: false,
      surgeMultiplier: 1.0,
      originalPriceCents: metrics.basePriceCents,
      finalPriceCents: metrics.basePriceCents,
      warningNotice: null,
    };
  }

  const { demandRatio, multiplier, isSurge } = calculateSurgeMultiplier(
    metrics.activeCheckoutViewers,
    metrics.remainingTickets,
  );

  const finalPriceCents = Math.round(metrics.basePriceCents * multiplier);

  const warningNotice = isSurge
    ? "SURGE PRICING ACTIVE: Due to extreme demand, ticket prices have temporarily increased."
    : null;

  return {
    eventId: metrics.eventId,
    demandRatio,
    isSurgeActive: isSurge,
    surgeMultiplier: multiplier,
    originalPriceCents: metrics.basePriceCents,
    finalPriceCents,
    warningNotice,
  };
}
