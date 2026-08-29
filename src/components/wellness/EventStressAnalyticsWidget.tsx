// =============================================================================
// File: src/components/wellness/EventStressAnalyticsWidget.tsx
// Task: Dynamic Mental Health — Automated Event Micro-Survey Engine
// Description: Organizer dashboard widget displaying real-time attendee stress
//              levels, break compliance rate, and peer support referral totals
//              for events tagged as 'High Stress' or lasting > 12 hours.
// =============================================================================

import { useMemo } from "react";
import {
  HeartPulse,
  AlertTriangle,
  Users,
  Droplets,
  Activity,
  Smile,
  Frown,
} from "lucide-react";
import {
  getEventStressAnalytics,
  type MicroSurveyResponsePayload,
} from "@/services/eventMentalHealthSurveyService";

export interface EventStressAnalyticsWidgetProps {
  eventId: string;
  eventTitle?: string;
  responses?: MicroSurveyResponsePayload[];
}

export function EventStressAnalyticsWidget({
  eventId,
  eventTitle = "High Stress Event",
  responses = [],
}: EventStressAnalyticsWidgetProps) {
  const analytics = useMemo(
    () => getEventStressAnalytics(eventId, responses),
    [eventId, responses]
  );

  const getStressColor = (score: number) => {
    if (score >= 4) return "text-rose-700 bg-rose-100 border-rose-400";
    if (score >= 3) return "text-amber-700 bg-amber-100 border-amber-400";
    return "text-emerald-700 bg-emerald-100 border-emerald-400";
  };

  if (analytics.totalResponses === 0) {
    return (
      <div
        className="neu-border border-4 border-black bg-white p-5 shadow-[4px_4px_0_0_#000] space-y-3"
        data-testid="event-stress-analytics-empty"
      >
        <div className="flex items-center gap-3 border-b-2 border-black pb-2">
          <HeartPulse className="h-5 w-5 text-teal-600" />
          <h3 className="font-display text-base font-black uppercase text-black">
            Event Mental Health Pulse
          </h3>
        </div>
        <p className="font-mono text-xs text-gray-500 italic">
          No attendee micro-survey responses logged yet for this event. Micro-surveys trigger automatically during check-in.
        </p>
      </div>
    );
  }

  const isHighBurnoutAlert =
    analytics.totalResponses > 0 &&
    analytics.highStressCount / analytics.totalResponses >= 0.25;

  return (
    <div
      className="neu-border border-4 border-black bg-white p-5 shadow-[6px_6px_0_0_#000] space-y-4"
      data-testid="event-stress-analytics-widget"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b-4 border-black pb-3">
        <div className="flex items-center gap-3">
          <div className="border-2 border-black bg-teal-400 p-2 text-black shadow-[2px_2px_0_0_#000]">
            <HeartPulse className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-display text-lg font-black uppercase tracking-tight text-black">
              Attendee Stress & Wellness Pulse
            </h3>
            <p className="font-mono text-xs text-gray-500 font-bold">
              {eventTitle} • {analytics.totalResponses} Pulse Checks
            </p>
          </div>
        </div>

        <span className="border-2 border-black bg-black text-white px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider">
          Automated Monitor
        </span>
      </div>

      {/* Burnout Risk Alert Banner */}
      {isHighBurnoutAlert && (
        <div
          className="border-2 border-black bg-rose-100 p-3 flex items-start gap-2.5 shadow-[2px_2px_0_0_#000]"
          data-testid="high-burnout-alert-banner"
        >
          <AlertTriangle className="h-5 w-5 text-rose-700 flex-shrink-0 mt-0.5" />
          <div className="font-mono text-xs text-rose-950">
            <span className="font-bold uppercase block text-rose-900">
              ⚠️ High Burnout Warning Threshold Reached
            </span>
            Over 25% of attendees report high stress (Level 4-5). Consider announcing a 10-minute quiet break or distributing water bottles.
          </div>
        </div>
      )}

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`border-2 border-black p-3 text-center shadow-[2px_2px_0_0_#000] ${getStressColor(analytics.avgStressScore)}`}>
          <span className="font-mono text-[10px] font-bold uppercase text-gray-700 block">
            Avg Stress Score
          </span>
          <p className="font-display text-2xl font-black mt-1">
            {analytics.avgStressScore} <span className="text-xs font-mono text-gray-600">/ 5</span>
          </p>
        </div>

        <div className="border-2 border-black bg-amber-50 p-3 text-center shadow-[2px_2px_0_0_#000]">
          <span className="font-mono text-[10px] font-bold uppercase text-amber-800 block flex items-center justify-center gap-1">
            <Droplets className="h-3.5 w-3.5" /> Break Rate
          </span>
          <p className="font-display text-2xl font-black text-amber-900 mt-1">
            {analytics.breakCompliancePercentage}%
          </p>
        </div>

        <div className="border-2 border-black bg-rose-50 p-3 text-center shadow-[2px_2px_0_0_#000]">
          <span className="font-mono text-[10px] font-bold uppercase text-rose-800 block flex items-center justify-center gap-1">
            <Frown className="h-3.5 w-3.5" /> High Burnout
          </span>
          <p className="font-display text-2xl font-black text-rose-700 mt-1">
            {analytics.highStressCount}
          </p>
        </div>

        <div className="border-2 border-black bg-purple-50 p-3 text-center shadow-[2px_2px_0_0_#000]">
          <span className="font-mono text-[10px] font-bold uppercase text-purple-800 block flex items-center justify-center gap-1">
            <Users className="h-3.5 w-3.5" /> Peer Referrals
          </span>
          <p className="font-display text-2xl font-black text-purple-900 mt-1">
            {analytics.peerSupportRequestsCount}
          </p>
        </div>
      </div>

      {/* Stress Level Distribution Bar */}
      <div className="border-2 border-black bg-gray-50 p-3 space-y-2 shadow-[2px_2px_0_0_#000]">
        <span className="font-mono text-xs font-black uppercase text-black block">
          Stress Level Distribution
        </span>
        <div className="flex h-4 w-full border border-black overflow-hidden bg-gray-200">
          {[1, 2, 3, 4, 5].map((lvl) => {
            const count = analytics.stressLevelBreakdown[lvl] || 0;
            const pct = analytics.totalResponses > 0 ? (count / analytics.totalResponses) * 100 : 0;
            const colors = ["", "bg-emerald-500", "bg-green-400", "bg-yellow-400", "bg-orange-500", "bg-rose-600"];
            return (
              <div
                key={lvl}
                style={{ width: `${pct}%` }}
                className={`${colors[lvl]} h-full transition-all`}
                title={`Level ${lvl}: ${count} (${Math.round(pct)}%)`}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between font-mono text-[10px] text-gray-600 font-bold uppercase">
          <span className="text-emerald-700">1: Relaxed</span>
          <span className="text-yellow-700">3: Moderate</span>
          <span className="text-rose-700">5: Burned Out</span>
        </div>
      </div>
    </div>
  );
}
