/**
 * SafeWalk Navigation Card
 * Displays safety metrics comparison, turn-by-turn safe corridor guidance,
 * and emergency hotline quick dial.
 * Issue #4139
 */

import React from 'react';
import {
  SafeWalkRouteResult,
  SafeRouteComparison,
} from '../../types/campusSafety';
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  Footprints,
  Phone,
  Sun,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react';

interface SafeWalkNavigationCardProps {
  routeResult: SafeWalkRouteResult | null;
  onEmergencyCall?: () => void;
}

export const SafeWalkNavigationCard: React.FC<SafeWalkNavigationCardProps> = ({
  routeResult,
  onEmergencyCall,
}) => {
  if (!routeResult) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
          <Footprints className="w-6 h-6" />
        </div>
        <h4 className="font-semibold text-slate-200 text-sm">
          Select Start and Destination on Campus Map
        </h4>
        <p className="text-xs text-slate-400 max-w-xs mx-auto">
          Click anywhere on the map or select campus buildings to generate an
          actively hazard-penalized safe route.
        </p>
      </div>
    );
  }

  const { safest_route, shortest_route, safety_gain_percentage, extra_walking_time_minutes } =
    routeResult;

  return (
    <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-5 space-y-5 text-slate-100 shadow-xl">
      {/* Header Metric Cards */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-100">
              Safe Walking Corridor Found
            </h4>
            <p className="text-xs text-emerald-400 font-medium">
              +{safety_gain_percentage}% safer than direct shortest route
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-2xl font-black text-emerald-400">
            {safest_route.overall_safety_score}
          </span>
          <span className="text-xs text-slate-400 block">/ 100 Safety Score</span>
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        {/* Safest Route Card */}
        <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-300 flex items-center space-x-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Safest Route (Recommended)</span>
            </span>
          </div>
          <div className="space-y-1 text-slate-300">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Distance:</span>
              <span className="font-semibold">{safest_route.total_distance_meters} m</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Est. Walk:</span>
              <span className="font-semibold">{safest_route.estimated_duration_minutes} min</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Well-Lit Path:</span>
              <span className="text-emerald-400 font-bold">
                {safest_route.well_lit_percentage}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Callbox Reach:</span>
              <span className="text-blue-400 font-bold">
                {safest_route.emergency_callbox_coverage_percentage}%
              </span>
            </div>
          </div>
        </div>

        {/* Shortest Route Card */}
        <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-rose-300 flex items-center space-x-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Direct Route (Unchecked)</span>
            </span>
          </div>
          <div className="space-y-1 text-slate-300">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Distance:</span>
              <span className="font-semibold">{shortest_route.total_distance_meters} m</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Est. Walk:</span>
              <span className="font-semibold">{shortest_route.estimated_duration_minutes} min</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Hazard Rating:</span>
              <span className="text-rose-400 font-bold">
                {100 - shortest_route.overall_safety_score} / 100
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Penalty Cost:</span>
              <span className="text-slate-300">Direct cutoff</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detour Overhead Notice */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs">
        <div className="flex items-center space-x-2 text-slate-300">
          <Clock className="w-4 h-4 text-amber-400" />
          <span>
            {extra_walking_time_minutes > 0
              ? `Only +${extra_walking_time_minutes} min walking detour to avoid unlit & suspicious incident zones.`
              : 'Direct path is already optimal and safe!'}
          </span>
        </div>
      </div>

      {/* Safety Advisories List */}
      {safest_route.safety_advisories.length > 0 && (
        <div className="space-y-1.5 text-xs">
          <h5 className="font-semibold text-slate-300">Active Routing Advisories</h5>
          <ul className="space-y-1">
            {safest_route.safety_advisories.map((adv, idx) => (
              <li
                key={idx}
                className="flex items-start space-x-1.5 text-emerald-400/90"
              >
                <span className="text-emerald-500 font-bold">•</span>
                <span>{adv}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Emergency Hotline Button */}
      <div className="pt-2">
        <button
          onClick={onEmergencyCall}
          className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 font-semibold text-xs transition"
        >
          <Phone className="w-4 h-4" />
          <span>Quick Dial Campus Police Escort (24/7 Dispatch)</span>
        </button>
      </div>
    </div>
  );
};
