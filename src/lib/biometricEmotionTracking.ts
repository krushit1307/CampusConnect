export interface ClientEmotionReading {
  joy: number; // 0 to 100
  surprise: number; // 0 to 100
  boredom: number; // 0 to 100
}

export interface AggregatedEmotionSnapshot {
  eventId: string;
  timestampOffsetSeconds: number;
  sampleSize: number;
  avgJoy: number;
  avgSurprise: number;
  avgBoredom: number;
  dominantEmotion: "joy" | "surprise" | "boredom";
}

export interface EmotionTimelineSummary {
  peakJoyTimestamp: string; // MM:SS format
  peakBoredomTimestamp: string; // MM:SS format
  peakSurpriseTimestamp: string; // MM:SS format
  totalSnapshots: number;
  executiveSummary: string;
}

/**
 * Formats seconds into MM:SS format for video player timeline overlays.
 */
export function formatSecondsToTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Aggregates client-side edge emotion readings collected within a 5-second window.
 */
export function aggregateEmotionBatch(
  eventId: string,
  timestampOffsetSeconds: number,
  readings: ClientEmotionReading[],
): AggregatedEmotionSnapshot {
  if (!readings || readings.length === 0) {
    return {
      eventId,
      timestampOffsetSeconds,
      sampleSize: 0,
      avgJoy: 0,
      avgSurprise: 0,
      avgBoredom: 0,
      dominantEmotion: "joy",
    };
  }

  const totals = readings.reduce(
    (acc, r) => ({
      joy: acc.joy + Math.max(0, Math.min(100, r.joy)),
      surprise: acc.surprise + Math.max(0, Math.min(100, r.surprise)),
      boredom: acc.boredom + Math.max(0, Math.min(100, r.boredom)),
    }),
    { joy: 0, surprise: 0, boredom: 0 },
  );

  const count = readings.length;
  const avgJoy = Number((totals.joy / count).toFixed(2));
  const avgSurprise = Number((totals.surprise / count).toFixed(2));
  const avgBoredom = Number((totals.boredom / count).toFixed(2));

  let dominantEmotion: "joy" | "surprise" | "boredom" = "joy";
  let maxScore = avgJoy;

  if (avgBoredom > maxScore) {
    dominantEmotion = "boredom";
    maxScore = avgBoredom;
  }
  if (avgSurprise > maxScore) {
    dominantEmotion = "surprise";
  }

  return {
    eventId,
    timestampOffsetSeconds,
    sampleSize: count,
    avgJoy,
    avgSurprise,
    avgBoredom,
    dominantEmotion,
  };
}

/**
 * Computes peak engagement timestamps and timeline graph markers for the organizer video dashboard.
 */
export function computeEmotionTimelineSummary(
  snapshots: AggregatedEmotionSnapshot[],
): EmotionTimelineSummary {
  if (!snapshots || snapshots.length === 0) {
    return {
      peakJoyTimestamp: "00:00",
      peakBoredomTimestamp: "00:00",
      peakSurpriseTimestamp: "00:00",
      totalSnapshots: 0,
      executiveSummary: "No biometric telemetry data available for this stream.",
    };
  }

  let peakJoy = snapshots[0];
  let peakBoredom = snapshots[0];
  let peakSurprise = snapshots[0];

  for (const s of snapshots) {
    if (s.avgJoy > peakJoy.avgJoy) peakJoy = s;
    if (s.avgBoredom > peakBoredom.avgBoredom) peakBoredom = s;
    if (s.avgSurprise > peakSurprise.avgSurprise) peakSurprise = s;
  }

  const joyTime = formatSecondsToTimestamp(peakJoy.timestampOffsetSeconds);
  const boredomTime = formatSecondsToTimestamp(peakBoredom.timestampOffsetSeconds);
  const surpriseTime = formatSecondsToTimestamp(peakSurprise.timestampOffsetSeconds);

  return {
    peakJoyTimestamp: joyTime,
    peakBoredomTimestamp: boredomTime,
    peakSurpriseTimestamp: surpriseTime,
    totalSnapshots: snapshots.length,
    executiveSummary: `Audience Joy peaked at ${joyTime}. Audience Boredom peaked at ${boredomTime}.`,
  };
}
