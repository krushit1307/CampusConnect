import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface MentorshipMatch {
  id: string;
  mentor_user_id: string;
  mentee_user_id: string;
  club_id: string | null;
  role_title: string;
  status: "pending" | "accepted" | "declined" | "completed";
  channel_id: string;
  intro_message: string;
  matched_at: string;
}

export interface AlumniProfile {
  id: string;
  user_id: string;
  grad_year: number;
  past_club_roles: Array<{ role: string; club_name: string; year: number }>;
  club_categories: string[];
  is_opted_in: boolean;
  max_mentees: number;
  bio?: string;
}

export function useExecutiveMentorship(userId?: string) {
  const [matches, setMatches] = useState<MentorshipMatch[]>([]);
  const [profile, setProfile] = useState<AlumniProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMentorshipData = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);

      // Fetch matches where user is mentee or mentor
      const { data: matchData } = await supabase
        .from("mentorship_matches")
        .select("*")
        .or(`mentee_user_id.eq.${userId},mentor_user_id.eq.${userId}`);

      setMatches((matchData as MentorshipMatch[]) || []);

      // Fetch alumni profile
      const { data: profileData } = await supabase
        .from("alumni_mentorship_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      setProfile(profileData as AlumniProfile | null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchMentorshipData();
  }, [fetchMentorshipData]);

  const requestMentorMatch = async (roleTitle: string, clubId?: string) => {
    if (!userId) return null;
    const { data, error: invokeError } = await supabase.functions.invoke("match-club-mentor", {
      body: { mentee_user_id: userId, role_title: roleTitle, club_id: clubId },
    });
    if (invokeError) throw new Error(invokeError.message);
    await fetchMentorshipData();
    return data;
  };

  const updateOptIn = async (isOptedIn: boolean, gradYear = 2024) => {
    if (!userId) return;
    const { data, error: upsertError } = await supabase
      .from("alumni_mentorship_profiles")
      .upsert(
        {
          user_id: userId,
          grad_year: gradYear,
          is_opted_in: isOptedIn,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (upsertError) throw upsertError;
    setProfile(data as AlumniProfile);
  };

  return { matches, profile, loading, error, requestMentorMatch, updateOptIn, refresh: fetchMentorshipData };
}
