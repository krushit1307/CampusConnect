import { createClient } from "../lib/supabase/client";
const supabase = createClient();

export interface LostMemberCampaign {
  id: string;
  club_id: string;
  user_id: string;
  total_past_attended: number;
  days_inactive: number;
  last_attended_at: string | null;
  status: "draft" | "approved" | "sent" | "dismissed";
  subject: string;
  draft_body: string;
  president_id: string | null;
  approved_at: string | null;
  sent_at: string | null;
  created_at: string;
  user?: {
    full_name?: string;
    email?: string;
    avatar_url?: string;
  };
}

export interface LostMemberAnalysisResult {
  userId: string;
  name: string;
  email: string;
  totalPastAttended: number;
  lastAttendedDate: string | null;
  daysSinceLastAttended: number;
  isLostMember: boolean;
}

/**
 * Analyzes event RSVP velocity and history to identify lost members.
 * Definition: attended > 3 events historically, but 0 events in the last 60 days.
 */
export function analyzeMemberAttendanceVelocity(
  rsvps: Array<{ eventDate: string | Date; status: string }>,
  referenceDate: Date = new Date(),
): { totalPastAttended: number; daysSinceLastAttended: number; isLostMember: boolean } {
  const attendedRsvps = rsvps
    .filter((r) => r.status === "attended")
    .map((r) => new Date(r.eventDate))
    .sort((a, b) => b.getTime() - a.getTime());

  const totalPastAttended = attendedRsvps.length;
  if (totalPastAttended === 0) {
    return { totalPastAttended: 0, daysSinceLastAttended: Infinity, isLostMember: false };
  }

  const latestDate = attendedRsvps[0];
  const diffDays = Math.floor(
    (referenceDate.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  const isLostMember = totalPastAttended > 3 && diffDays >= 60;

  return {
    totalPastAttended,
    daysSinceLastAttended: diffDays,
    isLostMember,
  };
}

/**
 * Generates personalized post-event check-in copy for lost members.
 */
export function generateLostMemberReengagementDraft(params: {
  memberName: string;
  clubName: string;
  presidentName: string;
  totalPastAttended?: number;
}): { subject: string; body: string } {
  const name = params.memberName?.trim() || "there";
  const club = params.clubName?.trim() || "the club";
  const president = params.presidentName?.trim() || "Club President";

  const subject = `We miss you at ${club}!`;
  const body = `Hey ${name},

We noticed we missed you at the last few ${club} meetings! Hope classes and everything else are going okay.

We'd love to have you back at our upcoming events. Let us know if there's anything we can do or if you have any feedback for our team.

Best,
${president} (${club} Leadership)`;

  return { subject, body };
}

export const lostMemberService = {
  /**
   * Triggers the backend churn detection analysis for a given club (or all clubs).
   */
  async runDetectionCron(clubId?: string): Promise<{ success: boolean; draftsCreated: number }> {
    const { data, error } = await supabase.rpc("detect_lost_members_and_draft_campaigns", {
      target_club_id: clubId || null,
    });

    if (error) {
      console.error("Error running lost member detection:", error);
      throw error;
    }

    return {
      success: true,
      draftsCreated: data?.drafts_created || 0,
    };
  },

  /**
   * Fetches drafted campaigns pending approval by club leadership.
   */
  async getPendingCampaigns(clubId: string): Promise<LostMemberCampaign[]> {
    const { data, error } = await supabase
      .from("lost_member_campaigns")
      .select("*, user:profiles!lost_member_campaigns_user_id_fkey(full_name, email, avatar_url)")
      .eq("club_id", clubId)
      .eq("status", "draft")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching lost member campaigns:", error);
      return [];
    }

    return (data as unknown as LostMemberCampaign[]) || [];
  },

  /**
   * Approves and sends re-engagement email to a lost member.
   */
  async approveAndSend(campaignId: string, customBody?: string): Promise<{ success: boolean }> {
    const updatePayload: Record<string, unknown> = {
      status: "approved",
      approved_at: new Date().toISOString(),
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (customBody) {
      updatePayload.draft_body = customBody;
    }

    const { error } = await supabase
      .from("lost_member_campaigns")
      .update(updatePayload)
      .eq("id", campaignId);

    if (error) throw error;

    return { success: true };
  },

  /**
   * Dismisses a campaign draft.
   */
  async dismissDraft(campaignId: string): Promise<{ success: boolean }> {
    const { error } = await supabase
      .from("lost_member_campaigns")
      .update({
        status: "dismissed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaignId);

    if (error) throw error;

    return { success: true };
  },
};
