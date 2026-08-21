export interface AccessibilityChecklistItem {
  id: string;
  category: "venue" | "audio_visual" | "seating" | "signage";
  question: string;
  isVerified: boolean;
  notes?: string;
}

export interface EventVenueContext {
  eventId: string;
  eventCategory: string; // e.g., 'lecture', 'concert', 'fair', 'workshop'
  venueType: string; // e.g., 'historic', 'outdoor', 'auditorium', 'classroom'
  hasAudioSystem: boolean;
  isMultiLevel: boolean;
}

export interface AccessibilityAuditRecord {
  id: string;
  eventId: string;
  checklist: AccessibilityChecklistItem[];
  isCompleted: boolean;
  completedAt?: string;
}

/**
 * Generates a tailored accessibility checklist based on event category and venue profile.
 */
export function generateAccessibilityChecklist(
  context: EventVenueContext,
): AccessibilityChecklistItem[] {
  const items: AccessibilityChecklistItem[] = [];

  // Universal Requirement
  items.push({
    id: "item_step_free_access",
    category: "venue",
    question: "Ensure step-free entry route from parking/entrance to the main space.",
    isVerified: false,
  });

  // Venue-specific rules
  if (context.venueType.toLowerCase() === "historic" || context.isMultiLevel) {
    items.push({
      id: "item_ramp_elevator",
      category: "venue",
      question: "Verify temporary ramp placement or elevator operation for elevated stages/floors.",
      isVerified: false,
    });
  }

  if (context.venueType.toLowerCase() === "outdoor") {
    items.push({
      id: "item_outdoor_pathways",
      category: "venue",
      question: "Check that outdoor terrain is firm and accessible for wheelchair users.",
      isVerified: false,
    });
  }

  // Event category / AV rules
  if (
    context.hasAudioSystem ||
    ["lecture", "concert", "panel"].includes(context.eventCategory.toLowerCase())
  ) {
    items.push({
      id: "item_mic_batteries",
      category: "audio_visual",
      question:
        "Check microphone batteries and ensure hearing loop / assistive listening system is active.",
      isVerified: false,
    });
  }

  if (["workshop", "fair", "lecture"].includes(context.eventCategory.toLowerCase())) {
    items.push({
      id: "item_reserved_seating",
      category: "seating",
      question: "Verify reserved seating area in front rows with clear sightlines.",
      isVerified: false,
    });
  }

  items.push({
    id: "item_signage",
    category: "signage",
    question: "Post clear directional signage for accessible restrooms and emergency exits.",
    isVerified: false,
  });

  return items;
}

/**
 * Evaluates whether all checklist items have been verified by the organizer.
 */
export function evaluateAuditCompletion(checklist: AccessibilityChecklistItem[]): {
  isCompleted: boolean;
  verifiedCount: number;
  totalCount: number;
} {
  const totalCount = checklist.length;
  const verifiedCount = checklist.filter((item) => item.isVerified).length;
  const isCompleted = totalCount > 0 && verifiedCount === totalCount;

  return { isCompleted, verifiedCount, totalCount };
}

/**
 * Determines if a public warning badge ("Pending Organizer Accessibility Confirmation") should be displayed.
 */
export function shouldDisplayPendingWarningBadge(
  audit: AccessibilityAuditRecord | null,
  eventStartTimeIso: string,
  nowMs: number = Date.now(),
): boolean {
  const startTimeMs = new Date(eventStartTimeIso).getTime();
  const hoursUntilEvent = (startTimeMs - nowMs) / (1000 * 60 * 60);

  // If event is within 48 hours and audit is missing or incomplete, show warning
  if (hoursUntilEvent <= 48 && hoursUntilEvent >= 0) {
    if (!audit || !audit.isCompleted) {
      return true;
    }
  }

  return false;
}
