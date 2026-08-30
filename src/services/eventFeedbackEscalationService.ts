import {
  EventFeedbackEscalation,
  EscalationEvaluationResult,
  NonRespondentAttendee,
  ClubPointPool,
  ClubPoolDeductionRecord,
  PushNotificationPayload,
  EventFeedbackEscalationConfig,
} from "../types/eventFeedbackEscalation";

export class EventFeedbackEscalationService {
  private escalations: Map<string, EventFeedbackEscalation> = new Map();
  private clubPools: Map<string, ClubPointPool> = new Map();
  private attendeesStore: Map<string, NonRespondentAttendee[]> = new Map();
  private deductionLogs: ClubPoolDeductionRecord[] = [];
  private dispatchedNotifications: PushNotificationPayload[] = [];

  private defaultConfig: EventFeedbackEscalationConfig = {
    evaluationDelayHours: 24,
    completionRateThresholdPercent: 15,
    baseRewardPoints: 50,
    escalatedRewardPoints: 200,
    escalationDurationHours: 4,
  };

  /**
   * Initializes or fetches a club's gamification point pool
   */
  public getOrCreateClubPool(
    clubId: string,
    clubName: string,
    initialBalance = 10000,
  ): ClubPointPool {
    let pool = this.clubPools.get(clubId);
    if (!pool) {
      pool = {
        clubId,
        clubName,
        totalBalance: initialBalance,
        escrowedBalance: 0,
        availableBalance: initialBalance,
        lastUpdatedAt: new Date().toISOString(),
      };
      this.clubPools.set(clubId, pool);
    }
    return pool;
  }

  /**
   * Registers event attendee check-in and survey status
   */
  public registerAttendees(eventId: string, attendees: NonRespondentAttendee[]): void {
    this.attendeesStore.set(eventId, attendees);
  }

  /**
   * Evaluates completion rate 24h post-event and triggers escalation if completion rate < 15%
   */
  public async evaluateEventFeedbackCompletion(
    eventId: string,
    eventName: string,
    clubId: string,
    clubName: string,
    eventEndedAt: string,
    customConfig?: Partial<EventFeedbackEscalationConfig>,
  ): Promise<EscalationEvaluationResult> {
    const config: EventFeedbackEscalationConfig = {
      ...this.defaultConfig,
      ...customConfig,
    };

    const attendees = this.attendeesStore.get(eventId) || [];
    const totalCheckIns = attendees.length;
    const totalResponses = attendees.filter((a) => a.hasSubmittedFeedback).length;

    const completionRate = totalCheckIns > 0 ? (totalResponses / totalCheckIns) * 100 : 0;
    const isEscalationTriggered =
      completionRate < config.completionRateThresholdPercent && totalCheckIns > 0;

    const now = new Date();
    const escalationId = `esc_${eventId}_${now.getTime()}`;
    const expiresAt = new Date(
      now.getTime() + config.escalationDurationHours * 60 * 60 * 1000,
    ).toISOString();

    const nonRespondents = attendees.filter((a) => !a.hasSubmittedFeedback);
    const extraPointsPerUser = config.escalatedRewardPoints - config.baseRewardPoints; // 150 points
    const totalExtraPointsNeeded = nonRespondents.length * extraPointsPerUser;

    let pointsDeducted = 0;
    let notificationCount = 0;
    let escalationRecord: EventFeedbackEscalation | undefined;

    if (isEscalationTriggered) {
      // Deduct from club point pool
      const clubPool = this.getOrCreateClubPool(clubId, clubName);
      pointsDeducted = Math.min(clubPool.availableBalance, totalExtraPointsNeeded);
      clubPool.availableBalance -= pointsDeducted;
      clubPool.escrowedBalance += pointsDeducted;
      clubPool.lastUpdatedAt = now.toISOString();

      const deductionRecord: ClubPoolDeductionRecord = {
        id: `deduct_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        clubId,
        eventId,
        pointsDeducted,
        reason: `Automated 4x Survey Incentive Escalation (${nonRespondents.length} non-respondents)`,
        deductedAt: now.toISOString(),
      };
      this.deductionLogs.push(deductionRecord);

      // Dispatch high-priority push notifications
      for (const attendee of nonRespondents) {
        const payload: PushNotificationPayload = {
          recipientId: attendee.userId,
          title: "⚡ URGENT: Event Feedback Bonus Quadrupled!",
          message: `URGENT: We need your feedback! The reward has been quadrupled to ${config.escalatedRewardPoints} points for the next ${config.escalationDurationHours} hours!`,
          priority: "URGENT",
          data: {
            eventId,
            escalationId,
            rewardPoints: config.escalatedRewardPoints,
            expiresAt,
            surveyUrl: `/events/${eventId}/feedback?reward=${config.escalatedRewardPoints}`,
          },
        };
        this.dispatchedNotifications.push(payload);
        attendee.notificationSent = true;
        attendee.notificationSentAt = now.toISOString();
        notificationCount++;
      }

      escalationRecord = {
        id: escalationId,
        eventId,
        eventName,
        clubId,
        clubName,
        eventEndedAt,
        evaluationTimestamp: now.toISOString(),
        totalCheckIns,
        totalResponses,
        completionRate: parseFloat((completionRate / 100).toFixed(4)),
        status: "ESCALATED",
        baseRewardPoints: config.baseRewardPoints,
        currentRewardPoints: config.escalatedRewardPoints,
        escalatedAt: now.toISOString(),
        expiresAt,
        totalPointsDeductedFromClub: pointsDeducted,
        nonRespondentsCount: nonRespondents.length,
        notificationsDispatchedCount: notificationCount,
        config,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      this.escalations.set(eventId, escalationRecord);
    }

    return {
      eventId,
      totalCheckIns,
      totalResponses,
      completionRatePercent: parseFloat(completionRate.toFixed(2)),
      thresholdPercent: config.completionRateThresholdPercent,
      isEscalationTriggered,
      reason: isEscalationTriggered
        ? `Completion rate (${completionRate.toFixed(1)}%) is below ${config.completionRateThresholdPercent}% threshold 24h post-event. Escalated reward to ${config.escalatedRewardPoints} pts.`
        : `Completion rate (${completionRate.toFixed(1)}%) meets required threshold. No incentive escalation needed.`,
      rewardPoints: isEscalationTriggered ? config.escalatedRewardPoints : config.baseRewardPoints,
      clubPointsDeducted: pointsDeducted,
      nonRespondentsNotified: notificationCount,
      escalation: escalationRecord,
    };
  }

  /**
   * Submits feedback and claims points for attendee
   */
  public async submitFeedback(
    eventId: string,
    userId: string,
  ): Promise<{ pointsAwarded: number; status: string }> {
    const attendees = this.attendeesStore.get(eventId) || [];
    const attendee = attendees.find((a) => a.userId === userId);
    const escalation = this.escalations.get(eventId);

    const isEscalationActive =
      escalation &&
      escalation.status === "ESCALATED" &&
      escalation.expiresAt &&
      new Date(escalation.expiresAt) > new Date();

    const pointsToAward = isEscalationActive
      ? escalation.currentRewardPoints
      : escalation?.baseRewardPoints || 50;

    if (attendee) {
      attendee.hasSubmittedFeedback = true;
    }

    if (escalation) {
      escalation.totalResponses += 1;
      escalation.completionRate =
        escalation.totalCheckIns > 0 ? escalation.totalResponses / escalation.totalCheckIns : 1;
      escalation.updatedAt = new Date().toISOString();
    }

    return {
      pointsAwarded: pointsToAward,
      status: isEscalationActive ? "ESCALATED_REWARD_CLAIMED" : "STANDARD_REWARD_CLAIMED",
    };
  }

  /**
   * Gets current active escalation for event
   */
  public getActiveEscalation(eventId: string): EventFeedbackEscalation | null {
    const esc = this.escalations.get(eventId);
    if (!esc) return null;

    // Check expiry
    if (esc.status === "ESCALATED" && esc.expiresAt && new Date(esc.expiresAt) <= new Date()) {
      esc.status = "EXPIRED";
      esc.currentRewardPoints = esc.baseRewardPoints;
      esc.updatedAt = new Date().toISOString();
    }

    return esc;
  }

  /**
   * Lists deduction records for audit
   */
  public getDeductionLogsByClub(clubId: string): ClubPoolDeductionRecord[] {
    return this.deductionLogs.filter((d) => d.clubId === clubId);
  }

  /**
   * Lists sent push notifications
   */
  public getDispatchedNotifications(recipientId?: string): PushNotificationPayload[] {
    if (recipientId) {
      return this.dispatchedNotifications.filter((n) => n.recipientId === recipientId);
    }
    return this.dispatchedNotifications;
  }

  /**
   * Resets in-memory storage for clean test suites
   */
  public clear(): void {
    this.escalations.clear();
    this.clubPools.clear();
    this.attendeesStore.clear();
    this.deductionLogs = [];
    this.dispatchedNotifications = [];
  }
}

export const eventFeedbackEscalationService = new EventFeedbackEscalationService();
