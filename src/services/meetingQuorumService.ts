import { supabase } from "@/lib/supabase/client";
import {
  DEFAULT_MAX_CHAIN_DEPTH,
  DEFAULT_MAX_PROXIES_PER_DELEGATE,
  computeQuorum,
  type AttendanceStatus,
  type MeetingMember,
  type MembershipTier,
  type ProxyDelegation,
  type QuorumPolicy,
  type QuorumReport,
  type QuorumRuleType,
} from "@/lib/meetingQuorum";

export interface ClubMeeting {
  id: string;
  club_id: string;
  title: string;
  agenda: string | null;
  scheduled_for: string;
  status: "scheduled" | "open" | "closed" | "cancelled";
  quorum_rule: QuorumRuleType;
  quorum_threshold: number | null;
  max_proxies_per_delegate: number;
  max_chain_depth: number;
  count_excused_in_base: boolean;
  tier_weights: Partial<Record<MembershipTier, number>> | null;
}

export interface MeetingRosterEntry extends MeetingMember {
  displayName: string;
  status: AttendanceStatus;
}

export interface MeetingSnapshot {
  meeting: ClubMeeting;
  roster: MeetingRosterEntry[];
  delegations: ProxyDelegation[];
  report: QuorumReport;
}

/**
 * Maps a club role title onto a voting tier. Clubs name their roles freely, so
 * anything unrecognised falls back to a general member rather than silently
 * gaining or losing voting weight.
 */
export function tierForRole(roleName: string | null | undefined): MembershipTier {
  const normalized = (roleName ?? "").trim().toLowerCase();

  if (["president", "vice president", "treasurer", "secretary", "chair"].includes(normalized)) {
    return "executive";
  }
  if (["committee", "core", "lead", "coordinator", "organiser", "organizer"].includes(normalized)) {
    return "core";
  }
  if (["associate", "alumni", "subscriber", "guest"].includes(normalized)) {
    return "associate";
  }
  return "general";
}

/** Turns a stored meeting row into the policy the quorum engine expects. */
export function policyFromMeeting(meeting: ClubMeeting): QuorumPolicy {
  return {
    rule: meeting.quorum_rule,
    threshold: meeting.quorum_threshold ?? undefined,
    maxProxiesPerDelegate: meeting.max_proxies_per_delegate ?? DEFAULT_MAX_PROXIES_PER_DELEGATE,
    maxChainDepth: meeting.max_chain_depth ?? DEFAULT_MAX_CHAIN_DEPTH,
    countExcusedInBase: meeting.count_excused_in_base,
    tierWeights: meeting.tier_weights ?? undefined,
  };
}

export const meetingQuorumService = {
  /** Meetings for a club, most recent first. */
  async listMeetings(clubId: string): Promise<ClubMeeting[]> {
    const { data, error } = await supabase
      .from("club_meetings")
      .select("*")
      .eq("club_id", clubId)
      .order("scheduled_for", { ascending: false });

    if (error) throw error;
    return (data ?? []) as ClubMeeting[];
  },

  /**
   * Loads everything the quorum panel needs in one go: the meeting, the roll
   * with each member's recorded attendance, and the proxies granted for it.
   */
  async getSnapshot(meetingId: string): Promise<MeetingSnapshot> {
    const { data: meeting, error: meetingError } = await supabase
      .from("club_meetings")
      .select("*")
      .eq("id", meetingId)
      .single();

    if (meetingError) throw meetingError;
    const typedMeeting = meeting as ClubMeeting;

    const [membersResult, attendanceResult, proxyResult] = await Promise.all([
      supabase
        .from("club_members")
        .select("user_id, status, club_roles(title), profiles(full_name)")
        .eq("club_id", typedMeeting.club_id)
        .eq("status", "approved"),
      supabase.from("meeting_attendance").select("user_id, status").eq("meeting_id", meetingId),
      supabase
        .from("meeting_proxies")
        .select("delegator_id, delegate_id, revoked")
        .eq("meeting_id", meetingId),
    ]);

    if (membersResult.error) throw membersResult.error;
    if (attendanceResult.error) throw attendanceResult.error;
    if (proxyResult.error) throw proxyResult.error;

    const attendanceByUser = new Map<string, AttendanceStatus>(
      (attendanceResult.data ?? []).map((row: any) => [row.user_id, row.status]),
    );

    const roster: MeetingRosterEntry[] = (membersResult.data ?? []).map((row: any) => ({
      userId: row.user_id,
      tier: tierForRole(row.club_roles?.title),
      eligibleToVote: row.status === "approved",
      displayName: row.profiles?.full_name ?? "Unnamed member",
      status: attendanceByUser.get(row.user_id) ?? "absent",
    }));

    const delegations: ProxyDelegation[] = (proxyResult.data ?? []).map((row: any) => ({
      delegatorId: row.delegator_id,
      delegateId: row.delegate_id,
      revoked: row.revoked,
    }));

    const report = computeQuorum(
      roster,
      roster.map((entry) => ({ userId: entry.userId, status: entry.status })),
      delegations,
      policyFromMeeting(typedMeeting),
    );

    return { meeting: typedMeeting, roster, delegations, report };
  },

  /** Records or updates one member's attendance. */
  async setAttendance(meetingId: string, userId: string, status: AttendanceStatus): Promise<void> {
    const { error } = await supabase.from("meeting_attendance").upsert(
      {
        meeting_id: meetingId,
        user_id: userId,
        status,
        checked_in_at: status === "present" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "meeting_id, user_id" },
    );

    if (error) throw error;
  },

  /** Grants a proxy for a meeting. One per delegator, enforced by the database. */
  async grantProxy(meetingId: string, delegatorId: string, delegateId: string): Promise<void> {
    const { error } = await supabase.from("meeting_proxies").insert({
      meeting_id: meetingId,
      delegator_id: delegatorId,
      delegate_id: delegateId,
    });

    if (error) throw error;
  },

  /** Withdraws a proxy without deleting the record, so the minutes stay honest. */
  async revokeProxy(meetingId: string, delegatorId: string): Promise<void> {
    const { error } = await supabase
      .from("meeting_proxies")
      .update({ revoked: true, revoked_at: new Date().toISOString() })
      .eq("meeting_id", meetingId)
      .eq("delegator_id", delegatorId);

    if (error) throw error;
  },

  /** Opens the meeting, which freezes the roll into attendance rows. */
  async openMeeting(meetingId: string): Promise<void> {
    const { error } = await supabase.rpc("open_club_meeting", { p_meeting_id: meetingId });
    if (error) throw error;
  },

  /** Closes the meeting so the recorded quorum can no longer drift. */
  async closeMeeting(meetingId: string): Promise<void> {
    const { error } = await supabase
      .from("club_meetings")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", meetingId);

    if (error) throw error;
  },
};
