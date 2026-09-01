/**
 * Enterprise Campus AI Mental Health & Peer Support Service
 * Provides confidential AI mood analysis, peer support group matching,
 * crisis helpline telemetry, and wellness metrics.
 */

export interface MentalHealthMoodLog {
  logId: string;
  studentId: string;
  moodScore: number; // 1 (Distressed) to 10 (Thriving)
  primaryEmotion: 'ANXIOUS' | 'STRESSED' | 'CALM' | 'OPTIMISTIC' | 'EXHAUSTED';
  aiSentimentSummary: string;
  loggedAt: string;
}

export interface PeerSupportGroup {
  groupId: string;
  title: string;
  topicCategory: 'EXAM_ANXIETY' | 'GRADUATE_STRESS' | 'MINDFULNESS_MEDITATION' | 'DEEP_SLEEP_WELLNESS';
  facilitatorName: string;
  activeMembersCount: number;
  maxCapacity: number;
  meetingSchedule: string;
  isAnonymousAllowed: boolean;
}

export class CampusMentalHealthService {
  private static moodLogs: MentalHealthMoodLog[] = [
    {
      logId: 'MOOD-101',
      studentId: 'STU-999',
      moodScore: 7,
      primaryEmotion: 'STRESSED',
      aiSentimentSummary: 'Student is experiencing moderate exam pressure; recommended 15-minute mindfulness breathing session.',
      loggedAt: '2026-08-21 18:30:00',
    },
  ];

  private static supportGroups: PeerSupportGroup[] = [
    {
      groupId: 'GRP-MINDFUL-101',
      title: 'Mindfulness & Midterm Stress Reduction Circle',
      topicCategory: 'MINDFULNESS_MEDITATION',
      facilitatorName: 'Sarah Jenkins, LCSW',
      activeMembersCount: 14,
      maxCapacity: 20,
      meetingSchedule: 'Every Tuesday at 17:00',
      isAnonymousAllowed: true,
    },
    {
      groupId: 'GRP-EXAM-202',
      title: 'STEM Finals Cognitive Anxiety Support',
      topicCategory: 'EXAM_ANXIETY',
      facilitatorName: 'Dr. Michael Chang',
      activeMembersCount: 18,
      maxCapacity: 25,
      meetingSchedule: 'Every Thursday at 18:30',
      isAnonymousAllowed: true,
    },
  ];

  public static getSupportGroups(): PeerSupportGroup[] {
    return this.supportGroups;
  }

  public static logStudentMood(
    studentId: string,
    moodScore: number,
    primaryEmotion: 'ANXIOUS' | 'STRESSED' | 'CALM' | 'OPTIMISTIC' | 'EXHAUSTED',
    notes: string
  ): MentalHealthMoodLog {
    let summary = 'Mood logged successfully.';
    if (moodScore <= 4) {
      summary = 'High stress detected. AI Assistant generated immediate counseling crisis helpline options.';
    } else if (moodScore >= 8) {
      summary = 'Positive mood state verified. Recommending peer mentorship participation.';
    } else {
      summary = 'Moderate stress level. Recommended guided meditation and study balance.';
    }

    const log: MentalHealthMoodLog = {
      logId: `MOOD-${Date.now()}`,
      studentId,
      moodScore,
      primaryEmotion,
      aiSentimentSummary: summary,
      loggedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    this.moodLogs.unshift(log);
    return log;
  }

  public static getStudentMoodLogs(studentId: string): MentalHealthMoodLog[] {
    return this.moodLogs.filter((l) => l.studentId === studentId);
  }

  public static getWellnessMetrics() {
    const totalLogs = this.moodLogs.length;
    const avgMood = Number(
      (this.moodLogs.reduce((acc, l) => acc + l.moodScore, 0) / (totalLogs || 1)).toFixed(1)
    );

    return {
      totalLogs,
      avgMood,
      activeSupportGroups: this.supportGroups.length,
      crisisHelplineStatus: '24/7 OPERATIONAL',
    };
  }
}
