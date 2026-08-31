export type EscalationStatus = "NORMAL" | "ESCALATED" | "EXPIRED" | "COMPLETED" | "CANCELLED";

export interface ClubPointPool {
  clubId: string;
  clubName: string;
  totalBalance: number;
  escrowedBalance: number;
  availableBalance: number;
  lastUpdatedAt: string;
}

export interface ClubPoolDeductionRecord {
  id: string;
  clubId: string;
  eventId: string;
  pointsDeducted: number;
  reason: string;
  deductedAt: string;
  txHash?: string;
}

export interface NonRespondentAttendee {
  userId: string;
  name: string;
  email: string;
  pushToken?: string;
  checkedInAt: string;
  hasSubmittedFeedback: boolean;
  notificationSent: boolean;
  notificationSentAt?: string | null;
}

export interface EventFeedbackEscalationConfig {
  evaluationDelayHours: number; // 24 hours post-event
  completionRateThresholdPercent: number; // 15% (0.15)
  baseRewardPoints: number; // 50 points
  escalatedRewardPoints: number; // 200 points (4x)
  escalationDurationHours: number; // 4 hours
}

export interface EventFeedbackEscalation {
  id: string;
  eventId: string;
  eventName: string;
  clubId: string;
  clubName: string;
  eventEndedAt: string;
  evaluationTimestamp: string;
  totalCheckIns: number;
  totalResponses: number;
  completionRate: number; // e.g. 0.08 for 8%
  status: EscalationStatus;
  baseRewardPoints: number;
  currentRewardPoints: number;
  escalatedAt?: string | null;
  expiresAt?: string | null;
  totalPointsDeductedFromClub: number;
  nonRespondentsCount: number;
  notificationsDispatchedCount: number;
  config: EventFeedbackEscalationConfig;
  createdAt: string;
  updatedAt: string;
}

export interface EscalationEvaluationResult {
  eventId: string;
  totalCheckIns: number;
  totalResponses: number;
  completionRatePercent: number;
  thresholdPercent: number;
  isEscalationTriggered: boolean;
  reason: string;
  rewardPoints: number;
  clubPointsDeducted: number;
  nonRespondentsNotified: number;
  escalation?: EventFeedbackEscalation;
}

export interface PushNotificationPayload {
  recipientId: string;
  title: string;
  message: string;
  priority: "HIGH" | "URGENT";
  data: {
    eventId: string;
    escalationId: string;
    rewardPoints: number;
    expiresAt: string;
    surveyUrl: string;
  };
}
