/**
 * Event Clash Conflict Card & Reschedule Optimizer Widget
 * Displays demographic overlap breakdown, audience cannibalization risk,
 * and 1-click clash-free alternative slot recommendations.
 * Issue #4140
 */

import React from 'react';
import {
  EventClashAnalysisResult,
  RescheduleAlternativeSlot,
} from '../../types/eventClashGraph';
import {
  AlertTriangle,
  Calendar,
  Clock,
  Sparkles,
  CheckCircle2,
  TrendingDown,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface EventClashConflictCardProps {
  analysis: EventClashAnalysisResult;
  onApplySlot: (slot: RescheduleAlternativeSlot) => void;
}

export const EventClashConflictCard: React.FC<EventClashConflictCardProps> = ({
  analysis,
  onApplySlot,
}) => {
  const { reschedule_recommendations, audience_cannibalization_breakdown } =
    analysis;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-6 text-slate-100 shadow-xl">
      {/* Top Conflict Breakdown */}
      <div className="space-y-3">
        <h4 className="font-bold text-sm text-slate-200 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span>Audience Cannibalization Conflicts ({audience_cannibalization_breakdown.length})</span>
        </h4>

        <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
          {audience_cannibalization_breakdown.map((item) => (
            <div
              key={item.event_id}
              className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1.5 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 truncate max-w-[200px]">
                  {item.event_title}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    item.metric.clash_severity === 'critical'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : item.metric.clash_severity === 'high'
                      ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  {item.metric.clash_severity} clash
                </span>
              </div>
              <p className="text-slate-400 text-[11px]">
                {item.metric.cannibalization_risk_summary}
              </p>
              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-700/60 font-mono">
                <span>Club: {item.club_name}</span>
                <span>Co-attendance: {item.metric.historical_rsvp_overlap_percentage}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Optimal Reschedule Recommendation Slots */}
      <div className="space-y-3 pt-2 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-sm text-slate-200 flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>AI Conflict-Free Reschedule Slots</span>
          </h4>
          <span className="text-xs text-emerald-400 font-medium">
            Zero Cannibalization
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {reschedule_recommendations.slice(0, 3).map((slot, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-xl border transition flex items-center justify-between gap-3 text-xs ${
                slot.is_optimal
                  ? 'bg-emerald-950/20 border-emerald-500/40'
                  : 'bg-slate-800/40 border-slate-700/60'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-semibold text-slate-200">
                    {new Date(slot.start_time).toLocaleDateString([], {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}{' '}
                    at{' '}
                    {new Date(slot.start_time).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {slot.is_optimal && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Best Turnout
                    </span>
                  )}
                </div>
                <p className="text-slate-400 text-[11px]">
                  {slot.recommendation_reason}
                </p>
              </div>

              <button
                onClick={() => onApplySlot(slot)}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg font-semibold text-xs transition ${
                  slot.is_optimal
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                }`}
              >
                <span>Apply</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
