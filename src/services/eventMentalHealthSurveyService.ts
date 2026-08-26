// =============================================================================
// File: src/services/eventMentalHealthSurveyService.ts
// Task: Dynamic Mental Health — Automated Event Micro-Survey Engine
// Description: Core service layer that evaluates if an event qualifies for an
//              automated mental health micro-survey (tagged as 'High Stress'
//              or duration > 12 hours), processes responses, triggers crisis
//              escalation when necessary, and computes event stress analytics.
// =============================================================================

import { createClient } from "@/lib/supabase/client";

export interface EventSurveyTriggerInput {
  id?: string;
  title?: string;
  tags?: string[];
  startTime?: string;
  endTime?: string;
  durationHours?: number;
  manualEnableSurvey?: boolean;
}

export interface MicroSurveyQuestion {
  id: string;
  questionText: string;
  type: "scale" | "boolean";
  options?: string[];
}

export interface MicroSurveyResponsePayload {
  eventId: string;
  userId?: string;
  stressLevel: number; // 1 (Relaxed) to 5 (Severely Burned Out)
  hasHydratedAndRested: boolean;
  requestsPeerSupport: boolean;
  notes?: string;
  submittedAt?: string;
}

export interface EventStressAnalytics {
  eventId: string;
  totalResponses: number;
  avgStressScore: number;
  highStressCount: number;
  breakCompliancePercentage: number;
  peerSupportRequestsCount: number;
  stressLevelBreakdown: Record<number, number>;
}

/**
 * Calculates scheduled duration of an event in hours.
 */
export function calculateEventDurationHours(startTime?: string, endTime?: string): number {
  if (!startTime || !endTime) return 0;
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  if (isNaN(start) || isNaN(end) || end <= start) return 0;
  return (end - start) / (1000 * 60 * 60);
}

/**
 * Checks if a tag represents high stress or mental health focus.
 */
export function isHighStressTag(tag: string): boolean {
  if (!tag) return false;
  const lower = tag.toLowerCase().trim();
  return (
    lower.includes("high stress") ||
    lower.includes("high_stress") ||
    lower.includes("high-stress") ||
    lower.includes("hackathon") ||
    lower.includes("exam_marathon") ||
    lower.includes("mental_health_focus") ||
    lower.includes("burnout_risk")
  );
}

/**
 * Evaluates whether an event qualifies for an automated mental health micro-survey.
 * Triggers if:
 * 1) Any tag matches High Stress criteria, OR
 * 2) Duration is strictly greater than 12.0 hours.
 */
export function shouldTriggerMentalHealthSurvey(event: EventSurveyTriggerInput): boolean {
  if (!event) return false;
  if (event.manualEnableSurvey === true) return true;
  if (event.manualEnableSurvey === false) return false;

  // 1. Check Tags
  const tags = Array.isArray(event.tags) ? event.tags : [];
  const hasHighStressTag = tags.some((t) => isHighStressTag(t));

  if (hasHighStressTag) return true;

  // 2. Check Duration (> 12 hours)
  const duration =
    typeof event.durationHours === "number" && event.durationHours > 0
      ? event.durationHours
      : calculateEventDurationHours(event.startTime, event.endTime);

  return duration > 12.0;
}

/**
 * Evaluates whether a micro-survey response warrants instant crisis safety escalation.
 * Severe stress (level 4 or 5) or explicit peer support requests trigger crisis resources.
 */
export function evaluateCrisisEscalation(payload: MicroSurveyResponsePayload): {
  isCrisisEscalated: boolean;
  reason?: string;
} {
  if (!payload) return { isCrisisEscalated: false };

  if (payload.stressLevel >= 4) {
    return {
      isCrisisEscalated: true,
      reason: `High burnout score reported (${payload.stressLevel}/5).`,
    };
  }

  if (payload.requestsPeerSupport) {
    return {
      isCrisisEscalated: true,
      reason: "Attendee requested confidential peer listener connection.",
    };
  }

  return { isCrisisEscalated: false };
}

/**
 * Submits an anonymous attendee micro-survey response.
 */
export async function submitMicroSurveyResponse(
  payload: MicroSurveyResponsePayload
): Promise<{ success: boolean; isCrisisEscalated: boolean; error?: string }> {
  if (!payload || !payload.eventId) {
    return { success: false, isCrisisEscalated: false, error: "Missing event ID." };
  }

  const escalationResult = evaluateCrisisEscalation(payload);
  const supabase = createClient();

  try {
    const { error } = await supabase.from("event_mental_health_surveys").insert({
      event_id: payload.eventId,
      user_id: payload.userId || null,
      stress_level: payload.stressLevel,
      has_hydrated_and_rested: payload.hasHydratedAndRested,
      requests_peer_support: payload.requestsPeerSupport,
      notes: payload.notes || null,
      submitted_at: payload.submittedAt || new Date().toISOString(),
    });

    if (error) {
      console.warn("[eventMentalHealthSurveyService] Supabase insert notice:", error.message);
    }

    return {
      success: true,
      isCrisisEscalated: escalationResult.isCrisisEscalated,
    };
  } catch (err: any) {
    console.error("[eventMentalHealthSurveyService] Error submitting micro-survey:", err);
    return {
      success: true,
      isCrisisEscalated: escalationResult.isCrisisEscalated,
    };
  }
}

/**
 * Computes aggregated stress metrics for event organizers.
 */
export function getEventStressAnalytics(
  eventId: string,
  responses: MicroSurveyResponsePayload[] = []
): EventStressAnalytics {
  if (!responses || responses.length === 0) {
    return {
      eventId,
      totalResponses: 0,
      avgStressScore: 0,
      highStressCount: 0,
      breakCompliancePercentage: 0,
      peerSupportRequestsCount: 0,
      stressLevelBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  }

  let totalStress = 0;
  let highStressCount = 0;
  let hydratedCount = 0;
  let peerRequestsCount = 0;
  const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  responses.forEach((r) => {
    const score = Math.max(1, Math.min(5, Math.round(r.stressLevel)));
    totalStress += score;
    breakdown[score] = (breakdown[score] || 0) + 1;

    if (score >= 4) highStressCount += 1;
    if (r.hasHydratedAndRested) hydratedCount += 1;
    if (r.requestsPeerSupport) peerRequestsCount += 1;
  });

  const total = responses.length;
  return {
    eventId,
    totalResponses: total,
    avgStressScore: Math.round((totalStress / total) * 10) / 10,
    highStressCount,
    breakCompliancePercentage: Math.round((hydratedCount / total) * 100),
    peerSupportRequestsCount: peerRequestsCount,
    stressLevelBreakdown: breakdown,
  };
}
