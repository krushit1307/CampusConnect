import { createClient } from "@/lib/supabase/client";

// =============================================================================
// Service: Event Post-Mortem & Retrospective Service
// Issue: #4208 - Develop a 'Dynamic Event "Post-Mortem" Analyzer'
// =============================================================================

export interface EventPostMortem {
  id?: string;
  event_id: string;
  club_id: string;
  created_by?: string;
  what_went_well: string;
  what_failed: string;
  advice_for_next_year: string;
  logistics_score: number; // 1-5
  budget_accuracy_score: number; // 1-5
  tags?: string[];
  created_at?: string;
  event_title?: string;
  event_date?: string;
}

export interface PendingPostMortemEvent {
  event_id: string;
  title: string;
  event_date: string;
  end_date?: string;
  club_id: string;
  hours_since_end: number;
}

export interface PostMortemGatingStatus {
  is_locked: boolean;
  pending_count: number;
  pending_events: PendingPostMortemEvent[];
}

/**
 * Checks if the organizer has pending post-mortems for major events ended >24h ago.
 */
export async function checkOrganizerPostMortemGate(
  userId: string,
  clubId?: string,
): Promise<PostMortemGatingStatus> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("check_pending_post_mortems", {
    p_user_id: userId,
    p_club_id: clubId || null,
  });

  if (error) {
    console.error("Error checking post-mortem gating status:", error);
    return { is_locked: false, pending_count: 0, pending_events: [] };
  }

  return (
    (data as PostMortemGatingStatus) || {
      is_locked: false,
      pending_count: 0,
      pending_events: [],
    }
  );
}

/**
 * Saves or updates a completed 5-question post-mortem retrospective.
 */
export async function saveEventPostMortem(
  postMortem: EventPostMortem,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return { success: false, error: "Must be logged in to submit a retrospective." };
  }

  const { error } = await supabase.from("event_post_mortems").upsert(
    {
      event_id: postMortem.event_id,
      club_id: postMortem.club_id,
      created_by: userRes.user.id,
      what_went_well: postMortem.what_went_well,
      what_failed: postMortem.what_failed,
      advice_for_next_year: postMortem.advice_for_next_year,
      logistics_score: postMortem.logistics_score,
      budget_accuracy_score: postMortem.budget_accuracy_score,
      tags: postMortem.tags || [],
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id" },
  );

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Searches club institutional memory retrospectives by keyword or event name.
 */
export async function searchClubPostMortems(
  clubId: string,
  query: string = "",
): Promise<EventPostMortem[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("search_club_post_mortems", {
    p_club_id: clubId,
    p_query: query,
  });

  if (error) {
    console.error("Error searching club post-mortems:", error);
    return [];
  }

  return ((data as any)?.post_mortems as EventPostMortem[]) || [];
}

/**
 * Analyzes event draft text (title + description) and suggests actionable historical tips from past retrospectives.
 */
export function findHistoricalRetrospectiveSuggestions(
  draftTitle: string,
  draftDescription: string,
  retrospectives: EventPostMortem[],
): Array<{ eventTitle: string; advice: string; keyword: string }> {
  const text = `${draftTitle} ${draftDescription}`.toLowerCase();
  const suggestions: Array<{ eventTitle: string; advice: string; keyword: string }> = [];

  const commonKeywords = [
    "pizza",
    "food",
    "catering",
    "av",
    "microphone",
    "projector",
    "speaker",
    "venue",
    "room",
    "registration",
    "check-in",
    "budget",
    "merch",
    "t-shirt",
    "workshop",
    "hackathon",
    "gala",
  ];

  for (const retro of retrospectives) {
    const retroText = `${retro.what_failed} ${retro.advice_for_next_year}`.toLowerCase();

    for (const kw of commonKeywords) {
      if (text.includes(kw) && retroText.includes(kw)) {
        suggestions.push({
          eventTitle: retro.event_title || "Past Event",
          advice: retro.advice_for_next_year || retro.what_failed,
          keyword: kw,
        });
        break; // Match 1 keyword per past event to avoid duplicate spam
      }
    }
  }

  return suggestions.slice(0, 3);
}
