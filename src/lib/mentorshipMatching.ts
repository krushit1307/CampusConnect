import { createClient } from "./supabase/client";

export interface MentorshipProfile {
  user_id: string;
  role: "mentor" | "mentee";
  major: string;
  interests: string[];
  career_goals?: string;
  bio?: string;
  capacity: number;
  is_active: boolean;
}

export interface RecommendedMentor {
  mentor_id: string;
  full_name: string;
  avatar_url: string | null;
  major: string;
  interests: string[];
  bio: string | null;
  capacity: number;
  active_mentees: number;
  compatibility_score: number;
  shared_interests_count: number;
}

export interface MentorshipPair {
  id: string;
  mentor_id: string;
  mentee_id: string;
  status: "pending" | "active" | "declined" | "dissolved";
  request_message?: string | null;
  dissolution_reason?: string | null;
  dissolved_at?: string | null;
  created_at: string;
}

/**
 * Calculates algorithmic compatibility score between a mentor and a mentee.
 * Exact major match = 50 pts, each shared interest = 10 pts.
 */
export function calculateCompatibilityScore(
  mentorMajor: string,
  mentorInterests: string[],
  menteeMajor: string,
  menteeInterests: string[],
): { score: number; sharedInterests: string[]; isMajorMatch: boolean } {
  let score = 0;

  const isMajorMatch =
    Boolean(mentorMajor && menteeMajor) &&
    mentorMajor.trim().toLowerCase() === menteeMajor.trim().toLowerCase();

  if (isMajorMatch) {
    score += 50;
  }

  const mentorInterestsNormalized = mentorInterests.map((i) => i.trim().toLowerCase());
  const sharedInterests = menteeInterests.filter((interest) =>
    mentorInterestsNormalized.includes(interest.trim().toLowerCase()),
  );

  score += sharedInterests.length * 10;

  return { score, sharedInterests, isMajorMatch };
}

/**
 * Fetch ranked recommended mentors for a given mentee.
 */
export async function fetchRecommendedMentors(
  menteeId: string,
): Promise<{ success: boolean; data: RecommendedMentor[]; error?: string }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_recommended_mentors", {
      p_mentee_id: menteeId,
    });

    if (error) throw error;
    return { success: true, data: (data as RecommendedMentor[]) || [] };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to load recommended mentors";
    return { success: false, data: [], error: errorMsg };
  }
}

/**
 * Sends a mentorship pairing request from mentee to mentor.
 */
export async function sendMentorshipRequest(
  menteeId: string,
  mentorId: string,
  message: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = createClient();

    // Check mentor capacity
    const { data: mentorProfile, error: profileErr } = await supabase
      .from("mentorship_profiles")
      .select("capacity")
      .eq("user_id", mentorId)
      .single();

    if (profileErr) throw profileErr;

    const { count: activeCount } = await supabase
      .from("mentorship_pairs")
      .select("id", { count: "exact", head: true })
      .eq("mentor_id", mentorId)
      .eq("status", "active");

    if ((activeCount || 0) >= (mentorProfile?.capacity || 2)) {
      return { success: false, message: "This mentor has reached their maximum mentee capacity." };
    }

    const { error: insertErr } = await supabase.from("mentorship_pairs").insert({
      mentor_id: mentorId,
      mentee_id: menteeId,
      request_message: message,
      status: "pending",
    });

    if (insertErr) throw insertErr;
    return { success: true, message: "Mentorship request sent successfully!" };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to send request";
    return { success: false, message: errorMsg };
  }
}

/**
 * Accepts or declines a mentorship request.
 */
export async function respondToMentorshipRequest(
  pairId: string,
  status: "active" | "declined",
): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("mentorship_pairs")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", pairId);

    if (error) throw error;
    return {
      success: true,
      message: status === "active" ? "Mentorship request accepted!" : "Request declined.",
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to update request";
    return { success: false, message: errorMsg };
  }
}

/**
 * Dissolves an active mentorship partnership with a private feedback reason.
 */
export async function dissolveMentorshipPartnership(
  pairId: string,
  reason: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("mentorship_pairs")
      .update({
        status: "dissolved",
        dissolution_reason: reason,
        dissolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", pairId);

    if (error) throw error;
    return { success: true, message: "Partnership dissolved successfully." };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to dissolve partnership";
    return { success: false, message: errorMsg };
  }
}
