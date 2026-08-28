import React, { useState } from "react";
import {
  EventFeedbackEscalation,
  EscalationEvaluationResult,
  ClubPointPool,
} from "../../types/eventFeedbackEscalation";
import { eventFeedbackEscalationService } from "../../services/eventFeedbackEscalationService";

interface EventFeedbackEscalationDashboardProps {
  eventId: string;
  eventName: string;
  clubId: string;
  clubName: string;
  eventEndedAt: string;
}

export const EventFeedbackEscalationDashboard: React.FC<EventFeedbackEscalationDashboardProps> = ({
  eventId,
  eventName,
  clubId,
  clubName,
  eventEndedAt,
}) => {
  const [evaluation, setEvaluation] = useState<EscalationEvaluationResult | null>(null);
  const [escalation, setEscalation] = useState<EventFeedbackEscalation | null>(
    eventFeedbackEscalationService.getActiveEscalation(eventId),
  );
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [clubPool] = useState<ClubPointPool>(
    eventFeedbackEscalationService.getOrCreateClubPool(clubId, clubName),
  );

  const handleRunEvaluation = async () => {
    setIsEvaluating(true);
    try {
      const result = await eventFeedbackEscalationService.evaluateEventFeedbackCompletion(
        eventId,
        eventName,
        clubId,
        clubName,
        eventEndedAt,
      );
      setEvaluation(result);
      if (result.escalation) {
        setEscalation(result.escalation);
      }
    } catch (err) {
      console.error("Error triggering escalation evaluation:", err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const currentRate = escalation
    ? Math.round(escalation.completionRate * 100)
    : evaluation
      ? evaluation.completionRatePercent
      : 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-foreground">
              Event Feedback Incentive Escalation Engine
            </h2>
            {escalation?.status === "ESCALATED" ? (
              <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400 animate-pulse">
                🔥 4x Escalation Active
              </span>
            ) : (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                Normal Incentive (50 pts)
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Event: <span className="font-medium text-foreground">{eventName}</span> | Club:{" "}
            <span className="font-medium text-foreground">{clubName}</span>
          </p>
        </div>

        <button
          onClick={handleRunEvaluation}
          disabled={isEvaluating}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isEvaluating ? "Evaluating 24h Threshold..." : "Evaluate 24h Completion Rate"}
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="text-xs font-medium text-muted-foreground">Completion Rate</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold ${
                currentRate < 15 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600"
              }`}
            >
              {currentRate}%
            </span>
            <span className="text-xs text-muted-foreground">/ 15% threshold</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {currentRate < 15 ? "⚠️ Below NLP minimum threshold" : "✅ Statistically sufficient"}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="text-xs font-medium text-muted-foreground">Active Survey Reward</div>
          <div className="mt-1 text-2xl font-bold text-foreground">
            {escalation?.currentRewardPoints || 50} pts
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {escalation?.status === "ESCALATED"
              ? "Quadrupled (+150 pts bonus)"
              : "Baseline incentive"}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="text-xs font-medium text-muted-foreground">Club Central Point Pool</div>
          <div className="mt-1 text-2xl font-bold text-foreground">
            {clubPool.availableBalance.toLocaleString()} pts
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Escrowed: {clubPool.escrowedBalance.toLocaleString()} pts
          </p>
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="text-xs font-medium text-muted-foreground">Escalation Window</div>
          <div className="mt-1 text-base font-bold text-foreground">
            {escalation?.status === "ESCALATED" ? "4 Hours Limited" : "Standby"}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Auto-reverts to 50 pts upon expiry
          </p>
        </div>
      </div>

      {/* Evaluation Output Summary */}
      {evaluation && (
        <div
          className={`rounded-xl border p-4 text-sm space-y-2 ${
            evaluation.isEscalationTriggered
              ? "border-amber-500/30 bg-amber-50/20 dark:bg-amber-950/20"
              : "border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/20"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">24-Hour Evaluation Outcome</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                evaluation.isEscalationTriggered
                  ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                  : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {evaluation.isEscalationTriggered ? "ESCALATION TRIGGERED" : "HEALTHY FEEDBACK RATE"}
            </span>
          </div>

          <p className="text-xs text-muted-foreground">{evaluation.reason}</p>

          {evaluation.isEscalationTriggered && (
            <div className="pt-2 border-t border-border/50 text-xs flex flex-wrap gap-4 text-muted-foreground">
              <span>
                📡 Notifications Dispatched:{" "}
                <strong className="text-foreground">{evaluation.nonRespondentsNotified}</strong>
              </span>
              <span>
                💰 Club Points Deducted:{" "}
                <strong className="text-foreground">{evaluation.clubPointsDeducted} pts</strong>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
