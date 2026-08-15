export type ChurnBucket = {
  hours_before_event: number;
  predicted_churn_rate?: number;
  predicted_churn_count?: number;
  actual_churn_count?: number;
};

export type WaitlistChurnPrediction = {
  event_id: string;
  capacity: number;
  waitlist_count: number;
  similar_event_count: number;
  expected_no_shows: number;
  recommended_overbook_capacity: number;
  weather_modifier: number;
  assumption: string;
  prediction_matrix: ChurnBucket[];
  actual_matrix: ChurnBucket[];
};

export type OverbookingPosture = "conservative" | "balanced" | "aggressive";

export const OVERBOOKING_POSTURES: Record<
  OverbookingPosture,
  { label: string; multiplier: number; description: string }
> = {
  conservative: {
    label: "Conservative",
    multiplier: 0.5,
    description: "Prioritizes fire-code headroom and accepts more empty seats.",
  },
  balanced: {
    label: "Balanced",
    multiplier: 0.75,
    description: "Uses three quarters of the modeled churn as a middle-ground estimate.",
  },
  aggressive: {
    label: "Aggressive",
    multiplier: 1,
    description: "Uses the full modeled churn and carries the highest attendance risk.",
  },
};

export function getRecommendedOverbookCapacity(
  prediction: Pick<
    WaitlistChurnPrediction,
    "capacity" | "expected_no_shows" | "recommended_overbook_capacity"
  >,
  posture: OverbookingPosture,
): number {
  const multiplier = OVERBOOKING_POSTURES[posture].multiplier;
  const additionalSeats = Math.round(prediction.expected_no_shows * multiplier);
  return Math.min(prediction.recommended_overbook_capacity, prediction.capacity + additionalSeats);
}

export function formatChurnBucket(hoursBeforeEvent: number): string {
  if (hoursBeforeEvent === 0) return "Event start";
  if (hoursBeforeEvent >= 24) return `${Math.round(hoursBeforeEvent / 24)}d before`;
  return `${hoursBeforeEvent}h before`;
}
