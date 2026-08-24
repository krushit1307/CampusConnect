export interface MemberActivityLedger {
  userId: string;
  userName: string;
  userEmail: string;
  clubId: string;
  currentRole: "member" | "committee" | "officer" | "president";
  eventsAttendedLast90Days: number;
  microTasksCompletedCount: number;
}

export interface PromotionSuggestion {
  userId: string;
  userName: string;
  clubId: string;
  currentRole: string;
  suggestedRole: "committee" | "officer";
  eventsAttendedCount: number;
  tasksCompletedCount: number;
  recommendationReason: string;
  isEligible: boolean;
}

export const HEURISTIC_THRESHOLDS = {
  MIN_EVENTS_ATTENDED: 5,
  MIN_TASKS_COMPLETED: 3,
};

/**
 * Evaluates member activity against engagement thresholds to detect active talent.
 */
export function evaluateMemberForPromotion(
  member: MemberActivityLedger,
): PromotionSuggestion | null {
  // Only evaluate base 'member' role for promotion to 'committee'
  if (member.currentRole !== "member") {
    return null;
  }

  const meetsEventsThreshold =
    member.eventsAttendedLast90Days >= HEURISTIC_THRESHOLDS.MIN_EVENTS_ATTENDED;
  const meetsTasksThreshold =
    member.microTasksCompletedCount >= HEURISTIC_THRESHOLDS.MIN_TASKS_COMPLETED;

  if (meetsEventsThreshold || meetsTasksThreshold) {
    let reason = `${member.userName} has been highly active! `;
    if (meetsEventsThreshold && meetsTasksThreshold) {
      reason += `Checked in to ${member.eventsAttendedLast90Days} club events in the past 90 days and completed ${member.microTasksCompletedCount} micro-volunteering tasks.`;
    } else if (meetsEventsThreshold) {
      reason += `Checked in to ${member.eventsAttendedLast90Days} club events in the past 90 days.`;
    } else {
      reason += `Completed ${member.microTasksCompletedCount} micro-volunteering tasks for the club.`;
    }

    return {
      userId: member.userId,
      userName: member.userName,
      clubId: member.clubId,
      currentRole: member.currentRole,
      suggestedRole: "committee",
      eventsAttendedCount: member.eventsAttendedLast90Days,
      tasksCompletedCount: member.microTasksCompletedCount,
      recommendationReason: reason,
      isEligible: true,
    };
  }

  return null;
}

/**
 * Runs heuristics analysis across a ledger of club members for automated cron batch execution.
 */
export function analyzeClubRolePromotions(
  membersLedger: MemberActivityLedger[],
): PromotionSuggestion[] {
  const suggestions: PromotionSuggestion[] = [];

  for (const member of membersLedger) {
    const suggestion = evaluateMemberForPromotion(member);
    if (suggestion) {
      suggestions.push(suggestion);
    }
  }

  return suggestions;
}

/**
 * Generates notification payload for the Club President.
 */
export function buildPresidentNotificationPayload(suggestion: PromotionSuggestion) {
  return {
    title: `Role Promotion Suggestion: ${suggestion.userName}`,
    body: `${suggestion.recommendationReason} Consider promoting them to the Event Committee.`,
    actionUrl: `/dashboard/clubs/${suggestion.clubId}/promotions`,
    suggestionId: `${suggestion.clubId}_${suggestion.userId}`,
  };
}
