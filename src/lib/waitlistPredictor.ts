export interface WaitlistProbabilityOptions {
  position: number;
  capacity: number;
  isFree?: boolean;
  pastEventsCount?: number;
  historicalDropoutRate?: number | null; // e.g. 0.20 for 20%
}

export interface WaitlistProbabilityResult {
  position: number;
  capacity: number;
  probabilityPercentage: number;
  tier: "High" | "Medium" | "Low" | "Unlikely";
  estimatedDropouts: number;
  historicalDropoutRate: number; // e.g. 20 for 20%
  isFallback: boolean;
  disclaimer: string;
}

export const DISCLAIMER_TEXT =
  "Estimated Probability based on historical attendance patterns — actual admission is not guaranteed.";

/**
 * Calculates waitlist admission probability score and tier based on historical dropout rates (#2980).
 * Falls back to global campus averages for new clubs with <2 past events.
 */
export function calculateWaitlistProbability({
  position,
  capacity,
  isFree = true,
  pastEventsCount = 0,
  historicalDropoutRate = null,
}: WaitlistProbabilityOptions): WaitlistProbabilityResult {
  const userPos = Math.max(1, position);
  const eventCapacity = Math.max(1, capacity);

  let dropoutRate = 0.20;
  let isFallback = true;

  if (pastEventsCount >= 2 && historicalDropoutRate !== null && !isNaN(historicalDropoutRate)) {
    dropoutRate = Math.max(0.01, Math.min(0.9, historicalDropoutRate));
    isFallback = false;
  } else {
    // Global Campus Category Fallback for new clubs (#2980)
    // Paid events: ~3% dropouts; Free events: ~22% dropouts
    dropoutRate = isFree ? 0.22 : 0.03;
    isFallback = true;
  }

  const estimatedDropouts = Math.max(1, Math.ceil(eventCapacity * dropoutRate));

  let probabilityPercentage = 50;

  if (userPos <= estimatedDropouts) {
    // User is within expected dropout window -> High/Medium chance (95% down to 65%)
    probabilityPercentage = Math.round(
      95 - ((userPos - 1) / Math.max(1, estimatedDropouts)) * 30
    );
  } else {
    // User is beyond expected dropout window -> Low/Unlikely chance (45% down to 2%)
    const overage = userPos - estimatedDropouts;
    probabilityPercentage = Math.max(
      2,
      Math.round(45 - (overage / Math.max(1, estimatedDropouts * 1.2)) * 40)
    );
  }

  let tier: "High" | "Medium" | "Low" | "Unlikely" = "Medium";
  if (probabilityPercentage >= 70) {
    tier = "High";
  } else if (probabilityPercentage >= 40) {
    tier = "Medium";
  } else if (probabilityPercentage >= 15) {
    tier = "Low";
  } else {
    tier = "Unlikely";
  }

  return {
    position: userPos,
    capacity: eventCapacity,
    probabilityPercentage,
    tier,
    estimatedDropouts,
    historicalDropoutRate: Math.round(dropoutRate * 100),
    isFallback,
    disclaimer: DISCLAIMER_TEXT,
  };
}
