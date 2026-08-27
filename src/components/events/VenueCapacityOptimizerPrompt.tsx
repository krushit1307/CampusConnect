// =============================================================================
// Component: VenueCapacityOptimizerPrompt
// Issue: #3463 - Implement 'Dynamic Capacity Optimization Suggestions'
// Description: Intercepts event creation when an organizer selects an under-capacity
// room (e.g. Room 101), showing a data-driven recommendation banner to upgrade
// to an available larger venue (e.g. Room 204, Capacity 50) instantly.
// =============================================================================

import React, { useState, useEffect } from "react";
import {
  analyzeVenueCapacityOptimization,
  type CapacityOptimizationResult,
} from "@/services/venueCapacityOptimizer";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import Check from "lucide-react/dist/esm/icons/check";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";

interface VenueCapacityOptimizerPromptProps {
  clubId: string;
  selectedVenue: string;
  eventDate?: string;
  onUpgradeVenue: (newVenueName: string, newCapacity: number) => void;
}

export function VenueCapacityOptimizerPrompt({
  clubId,
  selectedVenue,
  eventDate,
  onUpgradeVenue,
}: VenueCapacityOptimizerPromptProps) {
  const [recommendation, setRecommendation] = useState<CapacityOptimizationResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUpgraded, setIsUpgraded] = useState<boolean>(false);

  useEffect(() => {
    if (!clubId || !selectedVenue) {
      setRecommendation(null);
      return;
    }

    setIsLoading(true);
    setIsUpgraded(false);

    const timer = setTimeout(async () => {
      const result = await analyzeVenueCapacityOptimization(clubId, selectedVenue, eventDate);
      setRecommendation(result);
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [clubId, selectedVenue, eventDate]);

  if (isLoading) {
    return (
      <div className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl text-xs text-slate-400 font-mono flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-indigo-400 animate-spin" />
        Analyzing venue waitlist history & available capacities...
      </div>
    );
  }

  if (!recommendation || !recommendation.should_upgrade) return null;

  const handleUpgradeClick = () => {
    if (recommendation.suggested_venue_name && recommendation.suggested_capacity) {
      onUpgradeVenue(recommendation.suggested_venue_name, recommendation.suggested_capacity);
      setIsUpgraded(true);
    }
  };

  return (
    <div
      data-testid="capacity-optimization-prompt"
      className={`border rounded-2xl p-5 shadow-lg transition-all duration-300 ${
        isUpgraded
          ? "bg-emerald-950/80 border-emerald-500 text-emerald-100"
          : "bg-gradient-to-r from-amber-950/80 via-slate-900 to-indigo-950/80 border-amber-500/80 text-slate-100"
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`p-2.5 rounded-xl shrink-0 ${isUpgraded ? "bg-emerald-600 text-white" : "bg-amber-500/20 text-amber-400"}`}
          >
            {isUpgraded ? <Check className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold tracking-tight uppercase">
                {isUpgraded
                  ? "Venue Upgraded Successfully!"
                  : "Dynamic Capacity Optimization Suggestion"}
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-400/20 text-amber-300 border border-amber-500/40">
                PROACTIVE AI
              </span>
            </div>

            <p className="text-xs md:text-sm text-slate-200 mt-1 leading-relaxed">
              {isUpgraded
                ? `Updated event venue to ${recommendation.suggested_venue_name} (Capacity ${recommendation.suggested_capacity}).`
                : recommendation.prompt_message}
            </p>
          </div>
        </div>

        {!isUpgraded && (
          <button
            type="button"
            onClick={handleUpgradeClick}
            data-testid="upgrade-venue-btn"
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs md:text-sm rounded-xl transition-all shadow-lg hover:shadow-amber-500/20 shrink-0 flex items-center gap-2 active:scale-95"
          >
            <span>Upgrade Venue Instantly</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
