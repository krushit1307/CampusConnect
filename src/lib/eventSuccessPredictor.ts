export interface HistoricalEventData {
  id: string;
  clubId: string;
  category: string;
  rsvpCount: number;
  actualAttendanceCount: number;
}

export interface DraftEventInput {
  clubId: string;
  category: string;
  dayOfWeek: number; // 0-6
  hasCompetingSameDayEvents: boolean;
}

export interface PredictionForecastResult {
  expectedRsvpsRange: [number, number];
  expectedAttendanceRange: [number, number];
  confidencePercent: number;
  isColdStartFallback: boolean;
  historicalDropOffRate: number; // e.g. 0.40 for 40% drop-off
  notes: string;
}

export const CAMPUS_CATEGORY_BASELINES: Record<
  string,
  { avgRsvps: number; avgDropOffRate: number }
> = {
  Tech: { avgRsvps: 120, avgDropOffRate: 0.35 },
  Social: { avgRsvps: 150, avgDropOffRate: 0.45 },
  Academic: { avgRsvps: 80, avgDropOffRate: 0.25 },
  Sports: { avgRsvps: 100, avgDropOffRate: 0.3 },
  Default: { avgRsvps: 90, avgDropOffRate: 0.35 },
};

/**
 * Filters out statistical outliers using Median/1.5 StdDev clipping.
 */
export function filterOutliers(data: HistoricalEventData[]): HistoricalEventData[] {
  if (data.length <= 2) return data;

  const rsvps = data.map((d) => d.rsvpCount);
  const mean = rsvps.reduce((a, b) => a + b, 0) / rsvps.length;
  const variance = rsvps.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / rsvps.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return data;

  // Use 1.5 stdDev threshold to reliably prune severe viral spikes (e.g. 10x mean)
  return data.filter((d) => Math.abs(d.rsvpCount - mean) <= 1.5 * stdDev);
}

/**
 * Calculates predicted turnout, expected attendance ranges, and confidence scores.
 */
export function predictEventTurnout(
  input: DraftEventInput,
  history: HistoricalEventData[],
): PredictionForecastResult {
  const clubHistory = history.filter((h) => h.clubId === input.clubId);
  const cleanClubHistory = filterOutliers(clubHistory);

  let isColdStartFallback = false;
  let baseRsvps = 0;
  let dropOffRate = 0;

  if (cleanClubHistory.length < 2) {
    // Cold start fallback to campus-wide averages
    isColdStartFallback = true;
    const baseline = CAMPUS_CATEGORY_BASELINES[input.category] || CAMPUS_CATEGORY_BASELINES.Default;
    baseRsvps = baseline.avgRsvps;
    dropOffRate = baseline.avgDropOffRate;
  } else {
    // Weighted historical average calculation
    const totalRsvps = cleanClubHistory.reduce((sum, h) => sum + h.rsvpCount, 0);
    const totalAttendance = cleanClubHistory.reduce((sum, h) => sum + h.actualAttendanceCount, 0);

    baseRsvps = Math.round(totalRsvps / cleanClubHistory.length);
    const attendanceRatio = totalAttendance / (totalRsvps || 1);
    dropOffRate = 1 - attendanceRatio;
  }

  // Adjust for competing same-day events (-15% turnout penalty)
  if (input.hasCompetingSameDayEvents) {
    baseRsvps = Math.round(baseRsvps * 0.85);
  }

  const expectedAttendance = Math.round(baseRsvps * (1 - dropOffRate));

  // Construct 15% range boundaries
  const rsvpMin = Math.round(baseRsvps * 0.85);
  const rsvpMax = Math.round(baseRsvps * 1.15);
  const attMin = Math.round(expectedAttendance * 0.85);
  const attMax = Math.round(expectedAttendance * 1.15);

  const confidencePercent = isColdStartFallback
    ? 60
    : Math.min(90, 70 + cleanClubHistory.length * 4);

  const notes = isColdStartFallback
    ? "Prediction based on campus-wide category averages (insufficient club history)."
    : `Prediction derived from ${cleanClubHistory.length} historical events for this club.`;

  return {
    expectedRsvpsRange: [rsvpMin, rsvpMax],
    expectedAttendanceRange: [attMin, attMax],
    confidencePercent,
    isColdStartFallback,
    historicalDropOffRate: Number(dropOffRate.toFixed(2)),
    notes,
  };
}
