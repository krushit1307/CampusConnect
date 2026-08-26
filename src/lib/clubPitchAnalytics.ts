export interface PitchTelemetryPing {
  clubId: string;
  pitchId: string;
  sessionId: string;
  userId?: string;
  maxTimeListenedSec: number;
  totalDurationSec: number;
  swipedAway: boolean;
  timestamp?: number;
}

export interface PitchRetentionBucket {
  second: number;
  timeLabel: string;
  listenersCount: number;
  retentionPercentage: number;
  dropOffCount: number;
  dropOffRate: number;
}

export interface PitchRetentionAnalytics {
  pitchId: string;
  totalListens: number;
  completionCount: number;
  completionRate: number;
  avgTimeListenedSec: number;
  highestDropOffSecond: number;
  highestDropOffFormatted: string;
  dropOffInsight: string;
  retentionCurve: PitchRetentionBucket[];
}

/**
 * Formats seconds into MM:SS timestamp string (#4271).
 */
export function formatRetentionTimestamp(seconds: number): string {
  const secNum = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(secNum / 60);
  const secs = secNum % 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

/**
 * Aggregates 5-second interval retention curve analytics from raw audio telemetry pings (#4271).
 */
export function calculatePitchRetentionCurve(
  rawPings: PitchTelemetryPing[],
  pitchDurationSec: number = 60
): PitchRetentionAnalytics {
  if (!rawPings || rawPings.length === 0) {
    return {
      pitchId: "default",
      totalListens: 0,
      completionCount: 0,
      completionRate: 0,
      avgTimeListenedSec: 0,
      highestDropOffSecond: 0,
      highestDropOffFormatted: "0:00",
      dropOffInsight: "No audio pitch playback telemetry recorded yet.",
      retentionCurve: [],
    };
  }

  // Deduplicate by sessionId -> take max listened time
  const sessionMaxMap = new Map<string, number>();
  let pitchId = rawPings[0]?.pitchId || "default";

  rawPings.forEach((ping) => {
    const existing = sessionMaxMap.get(ping.sessionId) || 0;
    sessionMaxMap.set(ping.sessionId, Math.max(existing, ping.maxTimeListenedSec));
  });

  const totalListens = sessionMaxMap.size;
  const maxTimes = Array.from(sessionMaxMap.values());

  // Calculate completion count (listened to >= 90% of pitch duration)
  const completionCount = maxTimes.filter((t) => t >= pitchDurationSec * 0.9).length;
  const completionRate = Math.round((completionCount / totalListens) * 100);

  // Average time listened
  const totalListenedSum = maxTimes.reduce((acc, val) => acc + val, 0);
  const avgTimeListenedSec = Math.round((totalListenedSum / totalListens) * 10) / 10;

  // Generate 5-second step buckets (0, 5, 10, 15, ..., pitchDurationSec)
  const interval = 5;
  const bucketSecs: number[] = [];
  for (let s = 0; s <= pitchDurationSec; s += interval) {
    bucketSecs.push(s);
  }

  let maxDropOffCount = -1;
  let highestDropOffSecond = 0;

  const retentionCurve: PitchRetentionBucket[] = bucketSecs.map((sec, idx) => {
    // Count sessions that reached or passed this second mark
    const listenersCount = maxTimes.filter((t) => t >= sec).length;
    const retentionPercentage = Math.round((listenersCount / totalListens) * 100);

    let dropOffCount = 0;
    let dropOffRate = 0;

    if (idx > 0) {
      const prevListeners = maxTimes.filter((t) => t >= bucketSecs[idx - 1]).length;
      dropOffCount = prevListeners - listenersCount;
      dropOffRate = Math.round((dropOffCount / totalListens) * 100);

      if (dropOffCount > maxDropOffCount) {
        maxDropOffCount = dropOffCount;
        highestDropOffSecond = sec;
      }
    }

    return {
      second: sec,
      timeLabel: formatRetentionTimestamp(sec),
      listenersCount,
      retentionPercentage,
      dropOffCount,
      dropOffRate,
    };
  });

  const highestDropOffFormatted = formatRetentionTimestamp(highestDropOffSecond);
  const dropOffInsight =
    maxDropOffCount > 0
      ? `⚠️ Biggest audience drop-off occurs at ${highestDropOffFormatted} (${maxDropOffCount} listeners swiped away).`
      : "Great retention! Listeners stayed engaged through the pitch.";

  return {
    pitchId,
    totalListens,
    completionCount,
    completionRate,
    avgTimeListenedSec,
    highestDropOffSecond,
    highestDropOffFormatted,
    dropOffInsight,
    retentionCurve,
  };
}
