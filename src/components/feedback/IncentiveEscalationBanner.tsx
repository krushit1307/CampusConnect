import React, { useEffect, useState } from "react";
import { EventFeedbackEscalation } from "../../types/eventFeedbackEscalation";

interface IncentiveEscalationBannerProps {
  escalation: EventFeedbackEscalation;
  onTakeSurvey?: () => void;
  className?: string;
}

export const IncentiveEscalationBanner: React.FC<IncentiveEscalationBannerProps> = ({
  escalation,
  onTakeSurvey,
  className = "",
}) => {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number }>({
    hours: 4,
    minutes: 0,
    seconds: 0,
  });
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!escalation.expiresAt) return;

    const interval = setInterval(() => {
      const difference = new Date(escalation.expiresAt!).getTime() - new Date().getTime();

      if (difference <= 0) {
        setIsExpired(true);
        clearInterval(interval);
      } else {
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        const seconds = Math.floor((difference / 1000) % 60);
        setTimeLeft({ hours, minutes, seconds });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [escalation.expiresAt]);

  if (isExpired || escalation.status !== "ESCALATED") {
    return null;
  }

  const formatUnit = (num: number) => String(num).padStart(2, "0");

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border-2 border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 p-5 shadow-lg shadow-amber-500/5 ${className}`}
      data-testid="incentive-escalation-banner"
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left Info & Multiplier Badge */}
        <div className="flex items-start space-x-4">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md animate-pulse">
            <span className="text-xl font-black">4x</span>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                ⚡ URGENT REWARD BOOST
              </span>
              <span className="text-xs text-muted-foreground">Limited Time</span>
            </div>

            <h3 className="text-base font-bold text-foreground mt-1">
              Feedback Reward Quadrupled to{" "}
              <span className="text-amber-600 dark:text-amber-400 font-extrabold">
                {escalation.currentRewardPoints} Points
              </span>
              !
            </h3>

            <p className="text-xs text-muted-foreground mt-0.5">
              Help {escalation.clubName} improve future events. Your feedback is crucial for NLP
              sentiment analytics.
            </p>
          </div>
        </div>

        {/* Countdown & Action */}
        <div className="flex flex-row sm:flex-row items-center gap-4 w-full md:w-auto justify-between md:justify-end">
          {/* Countdown Clock */}
          <div className="flex items-center space-x-1.5 rounded-lg bg-card/80 border border-border px-3 py-1.5 font-mono text-sm font-semibold shadow-sm">
            <span className="text-xs text-muted-foreground mr-1">Expires in:</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-foreground">
              {formatUnit(timeLeft.hours)}
            </span>
            <span className="text-muted-foreground">:</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-foreground">
              {formatUnit(timeLeft.minutes)}
            </span>
            <span className="text-muted-foreground">:</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-amber-600 dark:text-amber-400">
              {formatUnit(timeLeft.seconds)}
            </span>
          </div>

          {/* CTA Button */}
          <button
            onClick={onTakeSurvey}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:from-amber-600 hover:to-orange-600 transition-all hover:scale-105 active:scale-95"
          >
            Claim {escalation.currentRewardPoints} Points →
          </button>
        </div>
      </div>
    </div>
  );
};
