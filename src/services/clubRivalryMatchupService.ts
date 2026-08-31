// =============================================================================
// Service: ClubRivalryMatchupService
// Purpose: Dynamic head-to-head club rivalry matchup calculations, tug-of-war
//          momentum balance tracking, and real-time leaderboard analytics.
// =============================================================================

import { createClient } from "@/lib/supabase/client";

export type RivalryMatchupState =
  | 'TIED'
  | 'CLUB_A_LEADING'
  | 'CLUB_B_LEADING'
  | 'DOMINANT_BLOWOUT'
  | 'DOWN_TO_THE_WIRE';

export interface ClubRivalryStats {
  club_id: string;
  club_name: string;
  logo_url: string;
  category: string;
  member_count: number;
  raw_event_points: number;
  per_capita_points: number;
  joint_collaboration_bonus: number;
  underdog_multiplier: number; // e.g. 1.0x - 2.2x
}

export interface ClubRivalryMatchup {
  id: string;
  matchup_title: string;
  category: string;
  club_a: ClubRivalryStats;
  club_b: ClubRivalryStats;
  starts_at: string;
  ends_at: string;
  days_remaining: number;
  season_name: string;
}

export interface RivalryMatchupAnalysis {
  matchup_id: string;
  club_a_total_score: number;
  club_b_total_score: number;
  lead_margin: number;
  leader_club_id: string | null;
  leader_club_name: string | null;
  momentum_balance_percent: number; // 0 to 100 (50 = perfectly balanced)
  matchup_state: RivalryMatchupState;
  catchup_points_per_day_needed: number;
  key_insights: string[];
}

export class ClubRivalryMatchupService {
  /**
   * Calculates dynamic rivalry scores, tug-of-war momentum balance, lead velocity,
   * and catch-up requirements between two competing rival clubs.
   */
  static calculateRivalryAnalysis(
    clubA: ClubRivalryStats,
    clubB: ClubRivalryStats,
    daysRemaining: number = 5
  ): RivalryMatchupAnalysis {
    // Total Weighted Score Formula:
    // Raw Event Points + (Per Capita Points * Underdog Multiplier * 10) + Joint Collaboration Bonus
    const scoreA = Math.round(
      clubA.raw_event_points +
        clubA.per_capita_points * clubA.underdog_multiplier * 10 +
        clubA.joint_collaboration_bonus
    );

    const scoreB = Math.round(
      clubB.raw_event_points +
        clubB.per_capita_points * clubB.underdog_multiplier * 10 +
        clubB.joint_collaboration_bonus
    );

    const totalCombinedScore = scoreA + scoreB || 1;
    // Momentum balance percentage (0% to 100%, 50% = tied)
    const momentumPercent = Math.round((scoreA / totalCombinedScore) * 1000) / 10;

    const leadMargin = Math.abs(scoreA - scoreB);
    let leaderId: string | null = null;
    let leaderName: string | null = null;

    if (scoreA > scoreB) {
      leaderId = clubA.club_id;
      leaderName = clubA.club_name;
    } else if (scoreB > scoreA) {
      leaderId = clubB.club_id;
      leaderName = clubB.club_name;
    }

    // Matchup State Classification
    let state: RivalryMatchupState = 'TIED';
    const percentDiff = Math.abs(scoreA - scoreB) / totalCombinedScore;

    if (scoreA === scoreB) {
      state = 'TIED';
    } else if (percentDiff < 0.08) {
      state = 'DOWN_TO_THE_WIRE';
    } else if (percentDiff >= 0.35) {
      state = 'DOMINANT_BLOWOUT';
    } else {
      state = scoreA > scoreB ? 'CLUB_A_LEADING' : 'CLUB_B_LEADING';
    }

    // Catchup velocity needed
    const safeDays = Math.max(1, daysRemaining);
    const catchupPerDay = Math.ceil(leadMargin / safeDays);

    // Dynamic Insights
    const insights: string[] = [];

    if (state === 'DOWN_TO_THE_WIRE') {
      insights.push(`Rivalry is neck-and-neck with only a ${leadMargin} point margin!`);
    } else if (state === 'DOMINANT_BLOWOUT') {
      insights.push(`${leaderName} holds a dominant lead of ${leadMargin} points.`);
    } else {
      insights.push(`${leaderName} is currently leading by ${leadMargin} points.`);
    }

    const trailingClubName = leaderId === clubA.club_id ? clubB.club_name : clubA.club_name;
    if (leadMargin > 0) {
      insights.push(`${trailingClubName} needs +${catchupPerDay} points/day to overtake before deadline.`);
    }

    if (clubA.joint_collaboration_bonus > 0 || clubB.joint_collaboration_bonus > 0) {
      insights.push("Joint collaboration event bonus active for both clubs (+150 pts).");
    }

    return {
      matchup_id: `analysis-${clubA.club_id}-vs-${clubB.club_id}`,
      club_a_total_score: scoreA,
      club_b_total_score: scoreB,
      lead_margin: leadMargin,
      leader_club_id: leaderId,
      leader_club_name: leaderName,
      momentum_balance_percent: momentumPercent,
      matchup_state: state,
      catchup_points_per_day_needed: catchupPerDay,
      key_insights: insights
    };
  }

  /**
   * Fetches active rivalry matchups across campus categories.
   */
  static async getActiveRivalryMatchups(): Promise<ClubRivalryMatchup[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("club_rivalry_matchups")
        .select("*");

      if (error || !data || data.length === 0) {
        return ClubRivalryMatchupService.generateMockRivalryMatchups();
      }

      return data as any[];
    } catch (err) {
      console.error("Error fetching rivalry matchups:", err);
      return ClubRivalryMatchupService.generateMockRivalryMatchups();
    }
  }

  /**
   * Generates mock dataset of active head-to-head club rivalries.
   */
  static generateMockRivalryMatchups(): ClubRivalryMatchup[] {
    return [
      {
        id: "rivalry-eng-101",
        matchup_title: "The Engineering Derby: IEEE vs. ACM",
        category: "Engineering & Tech",
        season_name: "Fall 2026 Campus Championship",
        starts_at: "2026-08-20T00:00:00Z",
        ends_at: "2026-09-10T23:59:59Z",
        days_remaining: 6,
        club_a: {
          club_id: "club-ieee",
          club_name: "IEEE Student Chapter",
          logo_url: "https://api.dicebear.com/7.x/identicon/svg?seed=IEEE",
          category: "Engineering",
          member_count: 140,
          raw_event_points: 1250,
          per_capita_points: 85,
          joint_collaboration_bonus: 150,
          underdog_multiplier: 1.15
        },
        club_b: {
          club_id: "club-acm",
          club_name: "ACM Computer Society",
          logo_url: "https://api.dicebear.com/7.x/identicon/svg?seed=ACM",
          category: "Engineering",
          member_count: 110,
          raw_event_points: 1180,
          per_capita_points: 92,
          joint_collaboration_bonus: 150,
          underdog_multiplier: 1.35
        }
      },
      {
        id: "rivalry-biz-102",
        matchup_title: "Wall Street Showdown: Finance Guild vs. Consulting Club",
        category: "Business & Finance",
        season_name: "Fall 2026 Campus Championship",
        starts_at: "2026-08-20T00:00:00Z",
        ends_at: "2026-09-10T23:59:59Z",
        days_remaining: 6,
        club_a: {
          club_id: "club-finance",
          club_name: "Student Finance Guild",
          logo_url: "https://api.dicebear.com/7.x/identicon/svg?seed=Finance",
          category: "Business",
          member_count: 180,
          raw_event_points: 1420,
          per_capita_points: 78,
          joint_collaboration_bonus: 100,
          underdog_multiplier: 1.05
        },
        club_b: {
          club_id: "club-consulting",
          club_name: "Management Consulting Club",
          logo_url: "https://api.dicebear.com/7.x/identicon/svg?seed=Consulting",
          category: "Business",
          member_count: 95,
          raw_event_points: 1350,
          per_capita_points: 98,
          joint_collaboration_bonus: 100,
          underdog_multiplier: 1.45
        }
      },
      {
        id: "rivalry-arts-103",
        matchup_title: "Debate Arena: Model UN vs. Parliamentary Debate",
        category: "Public Policy & Humanities",
        season_name: "Fall 2026 Campus Championship",
        starts_at: "2026-08-20T00:00:00Z",
        ends_at: "2026-09-10T23:59:59Z",
        days_remaining: 6,
        club_a: {
          club_id: "club-mun",
          club_name: "Model United Nations",
          logo_url: "https://api.dicebear.com/7.x/identicon/svg?seed=ModelUN",
          category: "Humanities",
          member_count: 120,
          raw_event_points: 980,
          per_capita_points: 82,
          joint_collaboration_bonus: 200,
          underdog_multiplier: 1.25
        },
        club_b: {
          club_id: "club-debate",
          club_name: "Parliamentary Debate Union",
          logo_url: "https://api.dicebear.com/7.x/identicon/svg?seed=Debate",
          category: "Humanities",
          member_count: 75,
          raw_event_points: 1020,
          per_capita_points: 105,
          joint_collaboration_bonus: 200,
          underdog_multiplier: 1.60
        }
      }
    ];
  }
}
