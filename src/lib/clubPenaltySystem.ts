import { createClient } from "./supabase/client";

export interface ClubInfraction {
  id: string;
  club_id: string;
  severity: "minor" | "moderate" | "severe" | "critical";
  description: string;
  points_penalized: number;
  issued_by?: string;
  status: "active" | "appealed" | "revoked";
  appeal_reason?: string;
  created_at: string;
}

export const CLUB_SUSPENSION_POINT_THRESHOLD = 10;
export const ROLLING_WINDOW_DAYS = 365;

/**
 * Calculates total active penalty points for a club issued within a rolling 365-day window.
 */
export function calculateRollingPenaltyPoints(
  infractions: ClubInfraction[],
  now: Date = new Date(),
): number {
  if (!infractions || infractions.length === 0) return 0;

  const windowStartMs = now.getTime() - ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  return infractions
    .filter((inf) => inf.status === "active")
    .filter((inf) => new Date(inf.created_at).getTime() >= windowStartMs)
    .reduce((sum, inf) => sum + (inf.points_penalized || 0), 0);
}

/**
 * Checks if a club's rolling penalty points reach or exceed the suspension threshold (10 points).
 */
export function isClubSuspensionThresholdReached(
  points: number,
  threshold = CLUB_SUSPENSION_POINT_THRESHOLD,
): boolean {
  return points >= threshold;
}

/**
 * Appeals a club infraction via Supabase RPC, placing it into 'appealed' status
 * and triggering automatic suspension re-evaluation.
 */
export async function appealInfraction(
  infractionId: string,
  appealReason: string,
): Promise<{ success: boolean; message: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("appeal_club_infraction", {
    p_infraction_id: infractionId,
    p_appeal_reason: appealReason,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  const res = data?.[0];
  return {
    success: res?.success ?? false,
    message: res?.message ?? "Appeal submitted successfully.",
  };
}

/**
 * Formats severity badge text and CSS styling.
 */
export function formatInfractionSeverityLabel(severity: string): {
  label: string;
  colorClass: string;
} {
  switch (severity.toLowerCase()) {
    case "critical":
      return {
        label: "Critical Severity",
        colorClass: "bg-red-500/10 text-red-600 border-red-500/20",
      };
    case "severe":
      return {
        label: "Severe Infraction",
        colorClass: "bg-orange-500/10 text-orange-600 border-orange-500/20",
      };
    case "moderate":
      return {
        label: "Moderate Infraction",
        colorClass: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      };
    case "minor":
    default:
      return {
        label: "Minor Infraction",
        colorClass: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      };
  }
}
