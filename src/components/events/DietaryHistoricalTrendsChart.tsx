/**
 * Dietary Historical Trends Chart Component
 * Issue #4290
 * Displays visual trends of dietary restriction distributions across the last 5 club events.
 */

import React from 'react';
import {
  HistoricalEventDietarySample,
  DietaryRestrictionKey,
} from '../../types/dietaryPredictiveModel';
import { DIETARY_LABELS } from '../../lib/dietaryPredictiveModel';
import { BarChart3, History } from 'lucide-react';

interface DietaryHistoricalTrendsChartProps {
  samples: HistoricalEventDietarySample[];
}

export const DietaryHistoricalTrendsChart: React.FC<
  DietaryHistoricalTrendsChartProps
> = ({ samples }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl text-slate-100 space-y-4">
      <div className="flex items-center space-x-2.5 border-b border-slate-800 pb-3">
        <History className="w-5 h-5 text-blue-400" />
        <div>
          <h4 className="font-bold text-sm">Historical 5-Event Dietary Trends</h4>
          <p className="text-xs text-slate-400">
            Empirical attendee selections used to train the predictive baseline model
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {samples.map((event) => (
          <div
            key={event.id}
            className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-2 text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">{event.event_title}</span>
              <span className="text-slate-400 font-mono">
                {new Date(event.event_date).toLocaleDateString()} • {event.total_attendees} RSVPs
              </span>
            </div>

            {/* Stacked Mini Bar */}
            <div className="h-3 w-full rounded-full overflow-hidden flex bg-slate-900">
              {(Object.keys(event.breakdown) as DietaryRestrictionKey[]).map((key) => {
                const count = event.breakdown[key];
                const pct = ((count / event.total_attendees) * 100).toFixed(1);
                if (count <= 0) return null;

                return (
                  <div
                    key={key}
                    style={{
                      width: `${pct}%`,
                      backgroundColor: DIETARY_LABELS[key]?.color || '#64748b',
                    }}
                    title={`${DIETARY_LABELS[key]?.label}: ${count} (${pct}%)`}
                    className="h-full hover:opacity-80"
                  />
                );
              })}
            </div>

            <div className="flex flex-wrap gap-3 text-[11px] text-slate-400 pt-1">
              <span>Vegan: <strong>{event.breakdown.vegan}</strong></span>
              <span>Vegetarian: <strong>{event.breakdown.vegetarian}</strong></span>
              <span>Gluten-Free: <strong>{event.breakdown.gluten_free}</strong></span>
              <span>Halal: <strong>{event.breakdown.halal}</strong></span>
              <span>General: <strong>{event.breakdown.general}</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
