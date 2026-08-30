// src/utils/eventComplianceChecker.ts
/**
 * Issue #3899 — Automated Health & Safety Compliance Checks
 *
 * Defines the trigger heuristics that decide whether an event needs a
 * permit uploaded before it can be published. Shared by the frontend
 * wizard (to gate the Publish button) and the backend controller (to
 * gate the actual state transition, since the frontend check alone can
 * be bypassed by calling the API directly).
 */

export interface ComplianceCheckInput {
  capacity?: number | null;
  category?: string | null;
  tags?: string[] | null;
}

export const HIGH_CAPACITY_THRESHOLD = 100;

const FOOD_KEYWORDS = ["food", "catering", "potluck", "bbq", "cookout"];

export type RequiredPermit = "FOOD_SAFETY_PERMIT" | "SECURITY_PERMIT";

/**
 * Returns the list of permits required for this event, based on the
 * trigger heuristics. Empty array means no permit is required.
 */
export function getRequiredPermits(input: ComplianceCheckInput): RequiredPermit[] {
  const permits: RequiredPermit[] = [];
  const category = (input.category || "").toLowerCase();
  const tags = (input.tags || []).map((t) => t.toLowerCase());
  const capacity = input.capacity ?? 0;

  const isFoodEvent = FOOD_KEYWORDS.some((kw) => category.includes(kw) || tags.includes(kw));
  if (isFoodEvent) {
    permits.push("FOOD_SAFETY_PERMIT");
  }

  if (capacity > HIGH_CAPACITY_THRESHOLD) {
    permits.push("SECURITY_PERMIT");
  }

  return permits;
}

/** Convenience boolean wrapper around getRequiredPermits. */
export function requiresCompliancePermit(input: ComplianceCheckInput): boolean {
  return getRequiredPermits(input).length > 0;
}