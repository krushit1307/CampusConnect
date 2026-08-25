/**
 * Dietary Predictive Estimate Widget for Catering Dashboard
 * Issue #4290
 * Renders statistical dietary estimations with capacity slider, safety buffers,
 * confidence intervals, and algorithmic caveat notice.
 */

import React, { useState } from 'react';
import {
  DietaryPredictionResult,
  DietaryRestrictionKey,
} from '../../types/dietaryPredictiveModel';
import {
  Utensils,
  Sparkles,
  AlertCircle,
  TrendingUp,
  ShieldCheck,
  Download,
  Info,
  CheckCircle2,
  Sliders,
} from 'lucide-react';

interface DietaryPredictiveEstimateWidgetProps {
  prediction: DietaryPredictionResult;
  onCapacityChange?: (capacity: number) => void;
  onOrderSubmit?: (prediction: DietaryPredictionResult) => Promise<void>;
}

export const DietaryPredictiveEstimateWidget: React.FC<
  DietaryPredictiveEstimateWidgetProps
> = ({ prediction, onCapacityChange, onOrderSubmit }) => {
  const [includeBuffer, setIncludeBuffer] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState(false);

  const categories = Object.values(prediction.categories);

  const handleOrder = async () => {
    setIsSubmitting(true);
    try {
      if (onOrderSubmit) {
        await onOrderSubmit(prediction);
      }
      setOrderConfirmed(true);
    } catch (err) {
      console.error('Order submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-100 space-y-6">
      {/* Header & Confidence Badge */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400">
            <Utensils className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-base flex items-center space-x-2">
              <span>Predictive Dietary Breakdown</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Pre-RSVP Model
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Aggregated from the last {prediction.historical_events_analyzed_count} events
              ({prediction.total_historical_attendees_sampled} historical attendees sampled)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs">
            <span className="text-slate-400">Model Confidence: </span>
            <span className="font-bold text-emerald-400 font-mono">
              {Math.round(prediction.confidence_score * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Mandatory Algorithmic Estimate Caveat Notice */}
      <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start space-x-2.5 text-xs text-amber-200">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold block text-amber-300">
            Algorithmic Baseline Estimate
          </span>
          <p className="text-[11px] text-amber-200/90 leading-relaxed">
            {prediction.disclaimer_notice} Allows organizers to place advance catering orders
            before RSVPs officially open.
          </p>
        </div>
      </div>

      {/* Venue Capacity Slider */}
      <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-2 text-xs">
        <div className="flex items-center justify-between font-semibold">
          <span className="text-slate-300 flex items-center space-x-1.5">
            <Sliders className="w-4 h-4 text-blue-400" />
            <span>Target Venue Capacity Scaling:</span>
          </span>
          <span className="text-sm font-bold text-emerald-400 font-mono">
            {prediction.venue_capacity} Attendees
          </span>
        </div>

        <input
          type="range"
          min="50"
          max="1500"
          step="25"
          value={prediction.venue_capacity}
          onChange={(e) => onCapacityChange && onCapacityChange(Number(e.target.value))}
          className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />

        <div className="flex justify-between text-[10px] text-slate-400 font-mono pt-1">
          <span>50 Small Workshop</span>
          <span>500 Standard Banquet (e.g. 50 Vegans)</span>
          <span>1,500 Large Arena</span>
        </div>
      </div>

      {/* Visual Proportion Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-300 font-semibold">
          <span>Dietary Distribution Proportion</span>
          <span>{prediction.venue_capacity} Total Meals</span>
        </div>

        <div className="h-4 w-full rounded-full overflow-hidden flex shadow-inner">
          {categories.map((c) => {
            const widthPct = (c.historical_ratio * 100).toFixed(1);
            if (Number(widthPct) <= 0) return null;

            return (
              <div
                key={c.key}
                style={{ width: `${widthPct}%`, backgroundColor: c.color_code }}
                title={`${c.label}: ${widthPct}% (~${c.predicted_headcount} meals)`}
                className="h-full transition-all duration-300 hover:opacity-85"
              />
            );
          })}
        </div>
      </div>

      {/* Itemized Predictions Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {categories.map((c) => {
          const count = includeBuffer ? c.safety_buffer_headcount : c.predicted_headcount;

          return (
            <div
              key={c.key}
              className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-1.5 text-xs hover:border-slate-600 transition"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200 flex items-center space-x-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: c.color_code }}
                  ></span>
                  <span>{c.label}</span>
                </span>
                <span className="font-mono text-slate-400 font-semibold">
                  {(c.historical_ratio * 100).toFixed(1)}%
                </span>
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <span className="text-xl font-extrabold text-slate-100 font-mono">
                  {count}{' '}
                  <span className="text-[11px] font-normal text-slate-400">meals</span>
                </span>
                {includeBuffer && c.key !== 'general' && (
                  <span className="text-[10px] text-emerald-400 font-medium">
                    +10% buffer
                  </span>
                )}
              </div>

              <div className="text-[10px] text-slate-400 font-mono">
                95% CI: [{c.confidence_lower_bound} – {c.confidence_upper_bound}]
              </div>
            </div>
          );
        })}
      </div>

      {/* Procurement Order Summary Footer */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 rounded-2xl bg-slate-800/80 border border-slate-700">
        <div className="space-y-0.5 text-xs">
          <span className="text-slate-400">Recommended Baseline Procurement Order:</span>
          <p className="text-lg font-bold text-emerald-400">
            {prediction.total_recommended_procurement_meals} Total Portions{' '}
            <span className="text-xs font-normal text-slate-300">
              (Includes safety margins on allergen & dietary dishes)
            </span>
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {orderConfirmed ? (
            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs">
              <CheckCircle2 className="w-5 h-5" />
              <span>Catering Order Exported!</span>
            </div>
          ) : (
            <button
              onClick={handleOrder}
              disabled={isSubmitting}
              className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isSubmitting ? 'Exporting...' : 'Export Baseline Order to Caterer'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
