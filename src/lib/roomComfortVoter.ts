export type ComfortVoteType = "TOO_COLD" | "PERFECT" | "TOO_HOT";

export interface ComfortVoteRecord {
  id: string;
  eventId: string;
  userId: string;
  vote: ComfortVoteType;
  createdAt: string; // ISO string
}

export interface ComfortConsensusMetrics {
  eventId: string;
  totalCheckedInCount: number;
  totalVotesInWindow: number;
  tooHotCount: number;
  tooColdCount: number;
  perfectCount: number;
  tooHotPercentage: number;
  tooColdPercentage: number;
  isAlertTriggered: boolean;
  alertType?: "HVAC_TOO_HOT" | "HVAC_TOO_COLD";
  facilitiesWebhookPayload?: {
    eventId: string;
    venueName: string;
    complaintType: string;
    affectedCount: number;
    affectedPercentage: number;
    message: string;
  };
}

export const ROLLING_WINDOW_MINUTES = 15;
export const ALERT_THRESHOLD_PERCENTAGE = 30.0; // > 30% consensus required

/**
 * Filters comfort votes submitted within the rolling 15-minute window.
 */
export function filterVotesInRollingWindow(
  votes: ComfortVoteRecord[],
  nowMs: number = Date.now(),
): ComfortVoteRecord[] {
  const windowStartMs = nowMs - ROLLING_WINDOW_MINUTES * 60 * 1000;
  return votes.filter((v) => {
    const voteTimeMs = new Date(v.createdAt).getTime();
    return voteTimeMs >= windowStartMs && voteTimeMs <= nowMs;
  });
}

/**
 * Calculates crowdsourced room comfort consensus metrics and evaluates HVAC dispatch triggers.
 */
export function evaluateRoomComfortConsensus(
  eventId: string,
  venueName: string,
  totalCheckedInCount: number,
  allVotes: ComfortVoteRecord[],
  nowMs: number = Date.now(),
): ComfortConsensusMetrics {
  const activeVotes = filterVotesInRollingWindow(allVotes, nowMs);

  let tooHotCount = 0;
  let tooColdCount = 0;
  let perfectCount = 0;

  for (const v of activeVotes) {
    if (v.vote === "TOO_HOT") tooHotCount++;
    else if (v.vote === "TOO_COLD") tooColdCount++;
    else if (v.vote === "PERFECT") perfectCount++;
  }

  const denominator = Math.max(1, totalCheckedInCount);
  const tooHotPercentage = Number(((tooHotCount / denominator) * 100).toFixed(1));
  const tooColdPercentage = Number(((tooColdCount / denominator) * 100).toFixed(1));

  let isAlertTriggered = false;
  let alertType: ComfortConsensusMetrics["alertType"];
  let facilitiesWebhookPayload: ComfortConsensusMetrics["facilitiesWebhookPayload"];

  if (tooHotPercentage >= ALERT_THRESHOLD_PERCENTAGE) {
    isAlertTriggered = true;
    alertType = "HVAC_TOO_HOT";
    facilitiesWebhookPayload = {
      eventId,
      venueName,
      complaintType: "EXTREME_HEAT",
      affectedCount: tooHotCount,
      affectedPercentage: tooHotPercentage,
      message: `Alert: ${tooHotCount} students (${tooHotPercentage}%) in ${venueName} are reporting extreme heat. Please lower HVAC cooling setpoint.`,
    };
  } else if (tooColdPercentage >= ALERT_THRESHOLD_PERCENTAGE) {
    isAlertTriggered = true;
    alertType = "HVAC_TOO_COLD";
    facilitiesWebhookPayload = {
      eventId,
      venueName,
      complaintType: "EXTREME_COLD",
      affectedCount: tooColdCount,
      affectedPercentage: tooColdPercentage,
      message: `Alert: ${tooColdCount} students (${tooColdPercentage}%) in ${venueName} are reporting extreme cold. Please increase HVAC heating setpoint.`,
    };
  }

  return {
    eventId,
    totalCheckedInCount,
    totalVotesInWindow: activeVotes.length,
    tooHotCount,
    tooColdCount,
    perfectCount,
    tooHotPercentage,
    tooColdPercentage,
    isAlertTriggered,
    alertType,
    facilitiesWebhookPayload,
  };
}
