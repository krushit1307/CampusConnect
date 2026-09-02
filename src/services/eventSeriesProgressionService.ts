/**
 * Event Series Progression Service
 *
 * Provides end-to-end multi-part event series tracking, completion percentage calculations,
 * milestone badge unlocks, and gamified graduation reward claims (#3934).
 */

export interface SeriesEventSession {
  id: string;
  seriesId: string;
  sessionNumber: number;
  title: string;
  description?: string;
  eventDate: string;
  location: string;
  isMandatory: boolean;
  isAttended?: boolean;
}

export interface SeriesMilestone {
  id: string;
  seriesId: string;
  milestoneName: string;
  requiredAttendedCount: number;
  badgeIcon: string;
  perkDescription: string;
  isUnlocked?: boolean;
}

export interface EventSeries {
  id: string;
  title: string;
  slug: string;
  description: string;
  clubId?: string;
  clubName?: string;
  totalEvents: number;
  requiredCompletionPercentage: number;
  rewardType: "PITCH_FUNDING_ELIGIBILITY" | "CERTIFICATE_OF_MASTERY" | "BADGE" | "SWAG_GRANT";
  rewardTitle: string;
  isActive: boolean;
  sessions: SeriesEventSession[];
  milestones: SeriesMilestone[];
}

export interface UserSeriesProgress {
  id: string;
  seriesId: string;
  seriesTitle: string;
  userId: string;
  userName: string;
  attendedEventIds: string[];
  eventsAttended: number;
  totalEvents: number;
  completionPercentage: number; // e.g. 40.0 for 4/10
  isCompleted: boolean;
  completedAt?: string | null;
  rewardClaimed: boolean;
  rewardClaimedAt?: string | null;
  unlockedMilestones: SeriesMilestone[];
  nextUpcomingSession?: SeriesEventSession | null;
}

export class EventSeriesProgressionService {
  private static seriesDatabase = new Map<string, EventSeries>();
  private static userProgressDatabase = new Map<string, UserSeriesProgress>();

  // Default seed series for testing & demo
  private static seedInitialData() {
    if (this.seriesDatabase.size > 0) return;

    const startupBootcamp: EventSeries = {
      id: "series-startup-bootcamp-2026",
      title: "Entrepreneurship Club: 10-Week Startup Bootcamp",
      slug: "startup-bootcamp-2026",
      description:
        "From ideation to investor demo day. Attend all 10 workshops to qualify for $5,000 equity-free student pitch grant funding.",
      clubId: "club-entrepreneurship-01",
      clubName: "Venture & Innovation Guild",
      totalEvents: 10,
      requiredCompletionPercentage: 100,
      rewardType: "PITCH_FUNDING_ELIGIBILITY",
      rewardTitle: "$5,000 Pitch Grant Eligibility & Founder Certificate",
      isActive: true,
      sessions: [
        {
          id: "sb-1",
          seriesId: "series-startup-bootcamp-2026",
          sessionNumber: 1,
          title: "Week 1: Problem Discovery & Customer Validation",
          eventDate: "2026-09-01T18:00:00Z",
          location: "Innovation Hall 101",
          isMandatory: true,
        },
        {
          id: "sb-2",
          seriesId: "series-startup-bootcamp-2026",
          sessionNumber: 2,
          title: "Week 2: Lean Canvas & Business Model Design",
          eventDate: "2026-09-08T18:00:00Z",
          location: "Innovation Hall 101",
          isMandatory: true,
        },
        {
          id: "sb-3",
          seriesId: "series-startup-bootcamp-2026",
          sessionNumber: 3,
          title: "Week 3: Rapid Prototyping & Wireframing",
          eventDate: "2026-09-15T18:00:00Z",
          location: "Design Studio A",
          isMandatory: true,
        },
        {
          id: "sb-4",
          seriesId: "series-startup-bootcamp-2026",
          sessionNumber: 4,
          title: "Week 4: Unit Economics & Financial Modeling",
          eventDate: "2026-09-22T18:00:00Z",
          location: "Innovation Hall 101",
          isMandatory: true,
        },
        {
          id: "sb-5",
          seriesId: "series-startup-bootcamp-2026",
          sessionNumber: 5,
          title: "Week 5: Midterm Founder Checkpoint & Peer Review",
          eventDate: "2026-09-29T18:00:00Z",
          location: "Student Union Ballroom",
          isMandatory: true,
        },
        {
          id: "sb-6",
          seriesId: "series-startup-bootcamp-2026",
          sessionNumber: 6,
          title: "Week 6: Go-To-Market & Growth Marketing",
          eventDate: "2026-10-06T18:00:00Z",
          location: "Innovation Hall 101",
          isMandatory: true,
        },
        {
          id: "sb-7",
          seriesId: "series-startup-bootcamp-2026",
          sessionNumber: 7,
          title: "Week 7: Technical Architecture & MVP Scaling",
          eventDate: "2026-10-13T18:00:00Z",
          location: "Computer Science Lab 3",
          isMandatory: true,
        },
        {
          id: "sb-8",
          seriesId: "series-startup-bootcamp-2026",
          sessionNumber: 8,
          title: "Week 8: Legal Incorporations & IP Strategy",
          eventDate: "2026-10-20T18:00:00Z",
          location: "Law Commons 204",
          isMandatory: true,
        },
        {
          id: "sb-9",
          seriesId: "series-startup-bootcamp-2026",
          sessionNumber: 9,
          title: "Week 9: Pitch Deck Storytelling & Slide Polish",
          eventDate: "2026-10-27T18:00:00Z",
          location: "Innovation Hall 101",
          isMandatory: true,
        },
        {
          id: "sb-10",
          seriesId: "series-startup-bootcamp-2026",
          sessionNumber: 10,
          title: "Week 10: Grand Demo Day & VC Jury Showcase",
          eventDate: "2026-11-03T17:00:00Z",
          location: "University Auditorium",
          isMandatory: true,
        },
      ],
      milestones: [
        {
          id: "m-1",
          seriesId: "series-startup-bootcamp-2026",
          milestoneName: "First Step: Idea Spark",
          requiredAttendedCount: 1,
          badgeIcon: "zap",
          perkDescription: "Early-stage mentor office hours access",
        },
        {
          id: "m-2",
          seriesId: "series-startup-bootcamp-2026",
          milestoneName: "Halfway Hero: Prototype Ready",
          requiredAttendedCount: 5,
          badgeIcon: "shield-check",
          perkDescription: "Free AWS & cloud hosting starter credits",
        },
        {
          id: "m-3",
          seriesId: "series-startup-bootcamp-2026",
          milestoneName: "Pitch Master: Series Champion",
          requiredAttendedCount: 10,
          badgeIcon: "crown",
          perkDescription: "Exclusive invite to VC Pitch Day and $5k grant pool",
        },
      ],
    };

    this.seriesDatabase.set(startupBootcamp.id, startupBootcamp);
  }

  /**
   * Get all active event series
   */
  static getAllSeries(): EventSeries[] {
    this.seedInitialData();
    return Array.from(this.seriesDatabase.values());
  }

  /**
   * Get a specific event series by ID
   */
  static getSeriesById(seriesId: string): EventSeries | undefined {
    this.seedInitialData();
    return this.seriesDatabase.get(seriesId);
  }

  /**
   * Register an event series
   */
  static registerSeries(series: EventSeries): void {
    this.seriesDatabase.set(series.id, series);
  }

  /**
   * Calculates completion percentage: (Attended / Total) * 100
   */
  static calculateCompletion(eventsAttended: number, totalEvents: number): number {
    if (totalEvents <= 0) return 0;
    const pct = (eventsAttended / totalEvents) * 100;
    return Number(Math.min(100, Math.max(0, pct)).toFixed(1));
  }

  /**
   * Get user's progression for a specific series
   */
  static getUserSeriesProgress(
    userId: string,
    seriesId: string,
    userName = "Student User",
  ): UserSeriesProgress {
    this.seedInitialData();
    const series = this.getSeriesById(seriesId);
    if (!series) {
      throw new Error(`Event series not found: ${seriesId}`);
    }

    const key = `${userId}:${seriesId}`;
    let progress = this.userProgressDatabase.get(key);

    if (!progress) {
      progress = {
        id: `prog-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        seriesId,
        seriesTitle: series.title,
        userId,
        userName,
        attendedEventIds: [],
        eventsAttended: 0,
        totalEvents: series.totalEvents,
        completionPercentage: 0,
        isCompleted: false,
        completedAt: null,
        rewardClaimed: false,
        rewardClaimedAt: null,
        unlockedMilestones: [],
        nextUpcomingSession: series.sessions[0] || null,
      };
      this.userProgressDatabase.set(key, progress);
    }

    return progress;
  }

  /**
   * Record attendance for an event session in a series
   */
  static recordAttendance(
    userId: string,
    seriesId: string,
    eventId: string,
    userName = "Student User",
  ): {
    progress: UserSeriesProgress;
    justCompleted: boolean;
    unlockedMilestone: SeriesMilestone | null;
  } {
    const series = this.getSeriesById(seriesId);
    if (!series) {
      throw new Error(`Event series not found: ${seriesId}`);
    }

    const progress = this.getUserSeriesProgress(userId, seriesId, userName);

    if (!progress.attendedEventIds.includes(eventId)) {
      progress.attendedEventIds.push(eventId);
    }

    progress.eventsAttended = progress.attendedEventIds.length;
    progress.completionPercentage = this.calculateCompletion(
      progress.eventsAttended,
      series.totalEvents,
    );

    let justCompleted = false;
    if (
      progress.completionPercentage >= series.requiredCompletionPercentage &&
      !progress.isCompleted
    ) {
      progress.isCompleted = true;
      progress.completedAt = new Date().toISOString();
      justCompleted = true;
    }

    // Check newly unlocked milestones
    let newlyUnlockedMilestone: SeriesMilestone | null = null;
    const previouslyUnlockedCount = progress.unlockedMilestones.length;

    progress.unlockedMilestones = series.milestones.filter(
      (m) => progress.eventsAttended >= m.requiredAttendedCount,
    );

    if (progress.unlockedMilestones.length > previouslyUnlockedCount) {
      newlyUnlockedMilestone = progress.unlockedMilestones[progress.unlockedMilestones.length - 1];
    }

    // Determine next upcoming unattended session
    progress.nextUpcomingSession =
      series.sessions.find((s) => !progress.attendedEventIds.includes(s.id)) || null;

    const key = `${userId}:${seriesId}`;
    this.userProgressDatabase.set(key, progress);

    return {
      progress,
      justCompleted,
      unlockedMilestone: newlyUnlockedMilestone,
    };
  }

  /**
   * Claim series completion reward
   */
  static claimReward(
    userId: string,
    seriesId: string,
  ): { success: boolean; rewardTitle: string; claimedAt: string } {
    const series = this.getSeriesById(seriesId);
    if (!series) throw new Error("Series not found");

    const progress = this.getUserSeriesProgress(userId, seriesId);
    if (!progress.isCompleted) {
      throw new Error("Cannot claim reward before achieving full completion criteria");
    }

    if (progress.rewardClaimed) {
      throw new Error("Reward has already been claimed for this series");
    }

    progress.rewardClaimed = true;
    progress.rewardClaimedAt = new Date().toISOString();

    const key = `${userId}:${seriesId}`;
    this.userProgressDatabase.set(key, progress);

    return {
      success: true,
      rewardTitle: series.rewardTitle,
      claimedAt: progress.rewardClaimedAt,
    };
  }

  /**
   * Get all active series progress for a user
   */
  static getUserActiveSeriesList(userId: string, userName = "Student User"): UserSeriesProgress[] {
    this.seedInitialData();
    const allSeries = this.getAllSeries();
    return allSeries.map((s) => this.getUserSeriesProgress(userId, s.id, userName));
  }

  /**
   * Reset internal in-memory DB for tests
   */
  static resetState(): void {
    this.seriesDatabase.clear();
    this.userProgressDatabase.clear();
  }
}
