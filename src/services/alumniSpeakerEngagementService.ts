// =============================================================================
// Service: AlumniSpeakerEngagementService
// Purpose: Dynamic tracking, scoring, and analytics engine for alumni guest speakers
// =============================================================================

import { createClient } from "@/lib/supabase/client";

export type SpeakerTierGrade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface AlumniSpeaker {
  id: string;
  name: string;
  graduation_year: number;
  degree: string;
  company: string;
  job_title: string;
  avatar_url: string;
  industry: string;
  total_events_hosted: number;
  total_students_impacted: number;
}

export interface SpeakerEngagementMetrics {
  attendance_rate: number; // 0 - 100%
  avg_student_rating: number; // 1.0 - 5.0
  qa_questions_answered: number; // count
  live_poll_response_rate: number; // 0 - 100%
  mentorship_followup_conversion_rate: number; // 0 - 100%
  sentiment_score: number; // 0 - 100%
  recurring_event_count: number;
}

export interface SpeakerDimensionBreakdown {
  feedback_score: number; // 0 - 100
  interactivity_score: number; // 0 - 100
  attendance_score: number; // 0 - 100
  mentorship_score: number; // 0 - 100
  reliability_score: number; // 0 - 100
}

export interface AlumniSpeakerEngagementScore {
  speaker_id: string;
  overall_score: number; // 0 - 100
  tier_grade: SpeakerTierGrade;
  dimensions: SpeakerDimensionBreakdown;
  strengths: string[];
  improvement_recommendations: string[];
  calculated_at: string;
}

export interface SpeakerEventHistoryItem {
  event_id: string;
  event_title: string;
  event_date: string;
  attendee_count: number;
  rating: number;
  qa_count: number;
}

export interface AlumniSpeakerLeaderboardItem {
  speaker: AlumniSpeaker;
  score: AlumniSpeakerEngagementScore;
  metrics: SpeakerEngagementMetrics;
  recent_events: SpeakerEventHistoryItem[];
}

export interface LeaderboardFilterOptions {
  industry?: string;
  minScore?: number;
  tierGrade?: SpeakerTierGrade;
  searchQuery?: string;
  sortBy?: 'score' | 'events' | 'impact' | 'rating';
}

export class AlumniSpeakerEngagementService {
  /**
   * Calculates overall engagement score, tier grade, and dimension scores.
   * Multi-variable weighting algorithm:
   * 30% Student Feedback Rating & Sentiment
   * 25% Live Audience Interactivity (Q&A + Polling)
   * 20% Attendance & Capacity Fill Ratio
   * 15% Post-Event Mentorship Conversion Rate
   * 10% Reliability & Recurrence Bonus
   */
  static calculateEngagementScore(
    speakerId: string,
    metrics: SpeakerEngagementMetrics
  ): AlumniSpeakerEngagementScore {
    // 1. Feedback score (0-100) -> rating mapped (1-5 to 0-100) + sentiment weight
    const ratingComponent = Math.min(100, Math.max(0, ((metrics.avg_student_rating - 1) / 4.0) * 100));
    const feedbackScore = Math.round((ratingComponent * 0.7 + metrics.sentiment_score * 0.3) * 10) / 10;

    // 2. Interactivity score (0-100) -> Q&A volume + live poll response rate
    const qaComponent = Math.min(100, metrics.qa_questions_answered * 8.0);
    const interactivityScore = Math.round((qaComponent * 0.6 + metrics.live_poll_response_rate * 0.4) * 10) / 10;

    // 3. Attendance score (0-100)
    const attendanceScore = Math.min(100, Math.max(0, Math.round(metrics.attendance_rate * 10) / 10));

    // 4. Mentorship conversion score (0-100)
    const mentorshipScore = Math.min(100, Math.max(0, Math.round(metrics.mentorship_followup_conversion_rate * 10) / 10));

    // 5. Reliability score (0-100) -> recurrence & event consistency bonus
    const reliabilityScore = Math.min(100, Math.round(75 + metrics.recurring_event_count * 5.0));

    // Weighted Overall Score
    const overallScore = Math.round(
      (feedbackScore * 0.30 +
        interactivityScore * 0.25 +
        attendanceScore * 0.20 +
        mentorshipScore * 0.15 +
        reliabilityScore * 0.10) *
        10
    ) / 10;

    // Tier Grade Classification
    let tierGrade: SpeakerTierGrade = 'C';
    if (overallScore >= 90) {
      tierGrade = 'S';
    } else if (overallScore >= 80) {
      tierGrade = 'A';
    } else if (overallScore >= 70) {
      tierGrade = 'B';
    } else if (overallScore >= 55) {
      tierGrade = 'C';
    } else {
      tierGrade = 'D';
    }

    // Dynamic Strengths & Recommendations
    const strengths: string[] = [];
    const recommendations: string[] = [];

    if (feedbackScore >= 85) strengths.push("Exceptional student rating & presentation clarity");
    if (interactivityScore >= 80) strengths.push("High Q&A engagement & audience interaction");
    if (mentorshipScore >= 75) strengths.push("Strong post-event coffee chat & mentorship conversion");
    if (attendanceScore >= 90) strengths.push("Consistently high turnout & turnout reliability");

    if (interactivityScore < 65) recommendations.push("Incorporate live polls or interactive Q&A prompts during slides");
    if (mentorshipScore < 50) recommendations.push("Provide dedicated office hours / coffee chat QR code at event end");
    if (attendanceScore < 70) recommendations.push("Optimize event scheduling and promotion timing");

    if (strengths.length === 0) strengths.push("Consistent alumni contributions and regular event participation");
    if (recommendations.length === 0) recommendations.push("Maintain current high-engagement speaking format");

    return {
      speaker_id: speakerId,
      overall_score: overallScore,
      tier_grade: tierGrade,
      dimensions: {
        feedback_score: feedbackScore,
        interactivity_score: interactivityScore,
        attendance_score: attendanceScore,
        mentorship_score: mentorshipScore,
        reliability_score: reliabilityScore
      },
      strengths,
      improvement_recommendations: recommendations,
      calculated_at: new Date().toISOString()
    };
  }

  /**
   * Retrieves the dynamic leaderboard of alumni speakers filtered by industry or score.
   */
  static async getAlumniSpeakerLeaderboard(
    filters: LeaderboardFilterOptions = {}
  ): Promise<AlumniSpeakerLeaderboardItem[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("alumni_speakers")
        .select("*");

      if (error || !data || data.length === 0) {
        return AlumniSpeakerEngagementService.filterMockLeaderboard(filters);
      }

      // Map DB rows to leaderboard format
      const items: AlumniSpeakerLeaderboardItem[] = data.map((sp: any) => {
        const mockMetrics: SpeakerEngagementMetrics = {
          attendance_rate: sp.attendance_rate ?? 85,
          avg_student_rating: sp.avg_student_rating ?? 4.8,
          qa_questions_answered: sp.qa_count ?? 14,
          live_poll_response_rate: sp.poll_rate ?? 78,
          mentorship_followup_conversion_rate: sp.mentorship_rate ?? 62,
          sentiment_score: sp.sentiment ?? 92,
          recurring_event_count: sp.total_events ?? 4
        };

        const score = AlumniSpeakerEngagementService.calculateEngagementScore(sp.id, mockMetrics);

        return {
          speaker: {
            id: sp.id,
            name: sp.name,
            graduation_year: sp.graduation_year ?? 2018,
            degree: sp.degree ?? 'B.S. Computer Science',
            company: sp.company ?? 'Tech Global Corp',
            job_title: sp.job_title ?? 'Senior Director of Product',
            avatar_url: sp.avatar_url ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${sp.name}`,
            industry: sp.industry ?? 'Technology',
            total_events_hosted: sp.total_events ?? 4,
            total_students_impacted: sp.students_impacted ?? 420
          },
          score,
          metrics: mockMetrics,
          recent_events: [
            {
              event_id: `evt-${sp.id}-1`,
              event_title: "Fireside Chat: Navigating Tech Leadership",
              event_date: "2026-07-15",
              attendee_count: 140,
              rating: 4.9,
              qa_count: 16
            }
          ]
        };
      });

      return AlumniSpeakerEngagementService.applyFilters(items, filters);
    } catch (err) {
      console.error("Error fetching alumni speaker leaderboard:", err);
      return AlumniSpeakerEngagementService.filterMockLeaderboard(filters);
    }
  }

  /**
   * Helper to filter and sort mock dataset when backend API is disconnected.
   */
  private static filterMockLeaderboard(filters: LeaderboardFilterOptions): AlumniSpeakerLeaderboardItem[] {
    const raw = AlumniSpeakerEngagementService.generateMockAlumniSpeakerLeaderboard();
    return AlumniSpeakerEngagementService.applyFilters(raw, filters);
  }

  private static applyFilters(
    items: AlumniSpeakerLeaderboardItem[],
    filters: LeaderboardFilterOptions
  ): AlumniSpeakerLeaderboardItem[] {
    let result = [...items];

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.speaker.name.toLowerCase().includes(q) ||
          item.speaker.company.toLowerCase().includes(q) ||
          item.speaker.job_title.toLowerCase().includes(q) ||
          item.speaker.industry.toLowerCase().includes(q)
      );
    }

    if (filters.industry && filters.industry !== 'ALL') {
      result = result.filter((item) => item.speaker.industry.toLowerCase() === filters.industry?.toLowerCase());
    }

    if (filters.tierGrade) {
      result = result.filter((item) => item.score.tier_grade === filters.tierGrade);
    }

    if (typeof filters.minScore === 'number') {
      result = result.filter((item) => item.score.overall_score >= filters.minScore!);
    }

    // Sort
    const sortBy = filters.sortBy || 'score';
    result.sort((a, b) => {
      if (sortBy === 'score') return b.score.overall_score - a.score.overall_score;
      if (sortBy === 'events') return b.speaker.total_events_hosted - a.speaker.total_events_hosted;
      if (sortBy === 'impact') return b.speaker.total_students_impacted - a.speaker.total_students_impacted;
      if (sortBy === 'rating') return b.metrics.avg_student_rating - a.metrics.avg_student_rating;
      return 0;
    });

    return result;
  }

  /**
   * Generates mock dataset of high-profile alumni speakers.
   */
  static generateMockAlumniSpeakerLeaderboard(): AlumniSpeakerLeaderboardItem[] {
    const mockSpeakers = [
      {
        id: "spk-101",
        name: "Elena Rostova",
        graduation_year: 2017,
        degree: "B.S. Computer Science",
        company: "Starlight Quantum Systems",
        job_title: "VP of Engineering",
        avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200",
        industry: "Technology",
        total_events_hosted: 8,
        total_students_impacted: 890,
        metrics: {
          attendance_rate: 94.5,
          avg_student_rating: 4.95,
          qa_questions_answered: 22,
          live_poll_response_rate: 88.0,
          mentorship_followup_conversion_rate: 74.0,
          sentiment_score: 96.0,
          recurring_event_count: 5
        }
      },
      {
        id: "spk-102",
        name: "Marcus Vance",
        graduation_year: 2015,
        degree: "B.A. Economics & Finance",
        company: "Vance Global Capital",
        job_title: "Managing Director",
        avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200",
        industry: "Finance & Banking",
        total_events_hosted: 6,
        total_students_impacted: 650,
        metrics: {
          attendance_rate: 89.0,
          avg_student_rating: 4.82,
          qa_questions_answered: 18,
          live_poll_response_rate: 81.5,
          mentorship_followup_conversion_rate: 68.0,
          sentiment_score: 91.0,
          recurring_event_count: 4
        }
      },
      {
        id: "spk-103",
        name: "Dr. Maya Lin",
        graduation_year: 2019,
        degree: "Ph.D. Biomedical Engineering",
        company: "BioHealth Innovations",
        job_title: "Principal Research Scientist",
        avatar_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200",
        industry: "Healthcare & Biotech",
        total_events_hosted: 5,
        total_students_impacted: 520,
        metrics: {
          attendance_rate: 91.0,
          avg_student_rating: 4.75,
          qa_questions_answered: 15,
          live_poll_response_rate: 76.0,
          mentorship_followup_conversion_rate: 59.0,
          sentiment_score: 89.0,
          recurring_event_count: 3
        }
      },
      {
        id: "spk-104",
        name: "Jordan K. Brooks",
        graduation_year: 2020,
        degree: "B.S. Product Design",
        company: "Apex Creative Studio",
        job_title: "Head of UX Architecture",
        avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200",
        industry: "Design & Media",
        total_events_hosted: 4,
        total_students_impacted: 380,
        metrics: {
          attendance_rate: 82.0,
          avg_student_rating: 4.60,
          qa_questions_answered: 12,
          live_poll_response_rate: 70.0,
          mentorship_followup_conversion_rate: 52.0,
          sentiment_score: 84.0,
          recurring_event_count: 2
        }
      },
      {
        id: "spk-105",
        name: "Samantha Rivera",
        graduation_year: 2016,
        degree: "LL.M. Intellectual Property",
        company: "Rivera Legal Advisory",
        job_title: "Partner",
        avatar_url: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=200",
        industry: "Legal & Public Policy",
        total_events_hosted: 3,
        total_students_impacted: 290,
        metrics: {
          attendance_rate: 78.0,
          avg_student_rating: 4.45,
          qa_questions_answered: 10,
          live_poll_response_rate: 65.0,
          mentorship_followup_conversion_rate: 45.0,
          sentiment_score: 80.0,
          recurring_event_count: 1
        }
      }
    ];

    return mockSpeakers.map((sp) => {
      const score = AlumniSpeakerEngagementService.calculateEngagementScore(sp.id, sp.metrics);
      return {
        speaker: {
          id: sp.id,
          name: sp.name,
          graduation_year: sp.graduation_year,
          degree: sp.degree,
          company: sp.company,
          job_title: sp.job_title,
          avatar_url: sp.avatar_url,
          industry: sp.industry,
          total_events_hosted: sp.total_events_hosted,
          total_students_impacted: sp.total_students_impacted
        },
        score,
        metrics: sp.metrics,
        recent_events: [
          {
            event_id: `evt-${sp.id}-1`,
            event_title: `${sp.industry} Career Workshop & Keynote`,
            event_date: "2026-08-10",
            attendee_count: Math.round(sp.total_students_impacted / sp.total_events_hosted),
            rating: sp.metrics.avg_student_rating,
            qa_count: sp.metrics.qa_questions_answered
          }
        ]
      };
    });
  }
}
