// src/components/events/DietaryForecastPanel.tsx
// -----------------------------------------------------------------------------
// Issue: #3931 — Implement 'Dynamic Dietary Restriction Forecasting'
// Issue: #4220 — Dynamic "Dietary Yield" Optimizer
// -----------------------------------------------------------------------------

import { useMemo, useState, useEffect, useCallback } from "react";
import {
  Utensils, Loader2, AlertCircle, RefreshCw,
  TrendingUp, Users, FileSpreadsheet,
} from "lucide-react";
import { useDietaryForecast } from "@/hooks/useDietaryForecast";
import {
  confidenceLabel, confidenceColor, topTags,
  totalForecastedMeals, isHighConfidence,
  type DietaryForecast,
} from "@/lib/dietaryForecast";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { CatererExportModal } from "./CatererExportModal";

export interface DietaryForecastPanelProps {
  eventId: string;
}

export function DietaryForecastPanel({ eventId }: DietaryForecastPanelProps) {
  const { forecast, isLoading, error, refresh } = useDietaryForecast(eventId);

  if (isLoading) {
    return (
      <div className="neu-border bg-white p-4 flex items-center gap-2"
           data-testid="dietary-forecast-loading">
        <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
        <span className="font-mono text-sm text-gray-600">
          Forecasting dietary needs…
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="neu-border bg-red-50 p-4 border-red-400"
           data-testid="dietary-forecast-error">
        <p className="font-mono text-sm text-red-800">
          Could not load the dietary forecast: {error}
        </p>
      </div>
    );
  }

  if (!forecast || !forecast.ok) {
    return (
      <div className="neu-border bg-amber-50 p-4 border-amber-400"
           data-testid="dietary-forecast-unavailable">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <p className="font-mono text-sm text-amber-800">
            {forecast?.error || "Dietary forecast is not available for this event."}
          </p>
        </div>
      </div>
    );
  }

  return <ForecastContent forecast={forecast} onRefresh={refresh} />;
}

function ForecastContent({
  forecast,
  onRefresh,
}: {
  forecast: DietaryForecast;
  onRefresh: () => Promise<void>;
}) {
  const top = useMemo(() => topTags(forecast, 8), [forecast]);
  const totalMeals = useMemo(() => totalForecastedMeals(forecast), [forecast]);
  const confLabel = confidenceLabel(forecast);
  const confColor = confidenceColor(forecast);
  const highConf = isHighConfidence(forecast);

  // State for Caterer Export Modal
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // States for Yield Optimizer constraints
  const [constraints, setConstraints] = useState<Record<string, number>>({});
  const [editingConstraints, setEditingConstraints] = useState<Record<string, string>>({});
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assignedResult, setAssignedResult] = useState<{ tag: string; count: number; names: string[] } | null>(null);
  
  const supabase = useMemo(() => createClient(), []);

  const loadConstraints = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("event_dietary_constraints")
        .select("dietary_tag, minimum_order_quantity")
        .eq("event_id", forecast.event_id);
      if (error) throw error;
      const mapping: Record<string, number> = {};
      (data || []).forEach((row) => {
        mapping[row.dietary_tag.toLowerCase()] = row.minimum_order_quantity;
      });
      setConstraints(mapping);
    } catch (err) {
      console.error("Failed to load dietary constraints", err);
    }
  }, [forecast.event_id, supabase]);

  useEffect(() => {
    void loadConstraints();
  }, [loadConstraints]);

  const handleSaveConstraint = async (tag: string) => {
    const tagLower = tag.toLowerCase();
    const rawVal = editingConstraints[tagLower] ?? "";
    const val = parseInt(rawVal, 10);
    if (isNaN(val) || val < 0) {
      toast.error("Please enter a valid non-negative number.");
      return;
    }
    try {
      const { error } = await supabase
        .from("event_dietary_constraints")
        .upsert({
          event_id: forecast.event_id,
          dietary_tag: tagLower,
          minimum_order_quantity: val
        });
      if (error) throw error;
      setConstraints((prev) => ({ ...prev, [tagLower]: val }));
      toast.success(`Minimum order of ${val} set for ${tag}.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to save constraint.");
    }
  };

  const handleOptimizeYield = async (tag: string, excessCount: number) => {
    setAssigning(tag);
    setAssignedResult(null);
    try {
      const { data, error } = await supabase.rpc("assign_excess_dietary_meals", {
        p_event_id: forecast.event_id,
        p_dietary_tag: tag,
        p_excess_count: excessCount
      });
      if (error) throw error;
      const names = (data || []).map((row: any) => row.name);
      setAssignedResult({ tag, count: names.length, names });
      toast.success(`Optimized! Assigned ${names.length} excess ${tag} meals.`);
      onRefresh(); // Refresh the main forecast query
      void loadConstraints(); // Reload constraints
    } catch (err: any) {
      toast.error(err.message || "Failed to optimize dietary yield.");
    } finally {
      setAssigning(null);
    }
  };

  return (
    <div className="neu-border bg-white p-6 space-y-4"
         data-testid="dietary-forecast-panel">
      <div className="flex items-center justify-between border-b-4 border-black pb-3">
        <div className="flex items-center gap-3">
          <Utensils className="h-6 w-6 text-orange-600" />
          <div>
            <h2 className="font-display text-xl font-black uppercase tracking-tight">
              Dietary Forecast
            </h2>
            <p className="font-mono text-xs text-gray-500">
              Predictive meal planning for your caterer
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`border-2 px-2 py-1 rounded-full text-[10px] font-bold uppercase ${confColor}`}
                data-testid="dietary-forecast-confidence">
            {confLabel} confidence
          </span>
          <button type="button" onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-1 border-2 border-black bg-amber-400 text-black px-2 py-1 font-mono text-xs font-bold uppercase hover:bg-amber-500 shadow-[2px_2px_0_0_#000] cursor-pointer"
            data-testid="open-caterer-export-modal-button">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Caterer Export
          </button>
          <button type="button" onClick={() => void onRefresh()}
            className="flex items-center gap-1 border-2 border-black bg-gray-100 px-2 py-1 font-mono text-xs font-bold uppercase hover:bg-gray-200"
            aria-label="Refresh forecast" data-testid="dietary-forecast-refresh">
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="border-2 border-orange-300 bg-orange-50 p-4 rounded-lg"
           data-testid="dietary-forecast-summary">
        <p className="font-mono text-sm text-orange-900 leading-relaxed">
          {forecast.summary}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatBox label="Venue Capacity" value={forecast.venue_capacity} icon={<Users className="h-4 w-4" />} />
        <StatBox label="Current RSVPs" value={forecast.total_rsvps} icon={<Users className="h-4 w-4" />} />
        <StatBox label="Total Tagged Meals" value={totalMeals} icon={<Utensils className="h-4 w-4" />} />
        <StatBox label="Current Weight"
          value={`${Math.round(forecast.current_weight * 100)}%`}
          icon={<TrendingUp className="h-4 w-4" />} />
      </div>

      {!highConf && (
        <div className="flex items-center gap-2 border-2 border-amber-400 bg-amber-50 p-3"
             data-testid="dietary-forecast-low-confidence-warning">
          <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <p className="font-mono text-xs text-amber-800">
            Low confidence — only {forecast.total_rsvps} RSVPs so far.
            The forecast leans heavily on this club's historical data.
            Encourage more attendees to RSVP for a more accurate prediction.
          </p>
        </div>
      )}

      <div className="overflow-x-auto" data-testid="dietary-forecast-table">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black bg-gray-50">
              <th className="text-left p-2 font-mono text-[10px] uppercase">Dietary Tag</th>
              <th className="text-right p-2 font-mono text-[10px] uppercase">Current %</th>
              <th className="text-right p-2 font-mono text-[10px] uppercase">Historical %</th>
              <th className="text-right p-2 font-mono text-[10px] uppercase">Blended %</th>
              <th className="text-right p-2 font-mono text-[10px] uppercase">Forecast Meals</th>
              <th className="text-right p-2 font-mono text-[10px] uppercase">Min Order</th>
            </tr>
          </thead>
          <tbody>
            {top.map((entry) => {
              const tagLower = entry.tag.toLowerCase();
              const minOrder = constraints[tagLower] ?? 0;
              const currentEditingVal = editingConstraints[tagLower] ?? String(minOrder);

              return (
                <tr key={entry.tag} className="border-b border-gray-200 hover:bg-gray-50"
                    data-testid={`forecast-row-${entry.tag}`}>
                  <td className="p-2 font-medium capitalize">{entry.tag}</td>
                  <td className="p-2 text-right font-mono text-gray-600">
                    {entry.current_percentage > 0 ? `${entry.current_percentage}%` : "—"}
                    {entry.current_count > 0 && (
                      <span className="text-gray-400 ml-1">({entry.current_count})</span>
                    )}
                  </td>
                  <td className="p-2 text-right font-mono text-gray-600">
                    {entry.historical_percentage > 0 ? `${entry.historical_percentage}%` : "—"}
                    {entry.historical_event_count > 0 && (
                      <span className="text-gray-400 ml-1">({entry.historical_event_count} events)</span>
                    )}
                  </td>
                  <td className="p-2 text-right font-mono font-bold text-gray-900">
                    {entry.blended_percentage}%
                  </td>
                  <td className="p-2 text-right">
                    <span className="font-display font-black text-orange-700 text-lg">
                      {entry.forecast_meals}
                    </span>
                  </td>
                  <td className="p-2 text-right">
                    {entry.tag !== "none" ? (
                      <div className="flex items-center justify-end gap-1.5" data-testid={`min-order-container-${entry.tag}`}>
                        <input
                          type="number"
                          min="0"
                          value={currentEditingVal}
                          onChange={(e) => setEditingConstraints((prev) => ({ ...prev, [tagLower]: e.target.value }))}
                          className="w-12 border border-black px-1 py-0.5 font-mono text-xs text-right outline-none"
                          data-testid={`min-order-input-${entry.tag}`}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveConstraint(entry.tag)}
                          className="border border-black bg-black text-white hover:bg-zinc-800 text-[10px] font-bold uppercase px-1.5 py-0.5 cursor-pointer"
                          data-testid={`min-order-save-${entry.tag}`}
                        >
                          Set
                        </button>
                      </div>
                    ) : (
                      <span className="font-mono text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Yield Optimizer prompts */}
      {top.map((entry) => {
        if (entry.tag === "none") return null;
        const minOrder = constraints[entry.tag.toLowerCase()] ?? 0;
        const actualRsvps = entry.current_count;
        if (minOrder > 0 && actualRsvps < minOrder) {
          const excessMeals = minOrder - actualRsvps;
          return (
            <div
              key={`yield-opt-${entry.tag}`}
              className="border-4 border-black bg-yellow-100 p-4 shadow-[4px_4px_0_0_#000] space-y-3"
              data-testid={`yield-optimizer-prompt-${entry.tag}`}
            >
              <div className="flex items-center gap-2 border-b-2 border-black pb-2">
                <span className="border-2 border-black bg-black text-white px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
                  Yield Optimizer Alert
                </span>
                <p className="font-mono text-xs font-bold text-black uppercase">
                  Dietary Minimum Gap Detected
                </p>
              </div>
              <p className="font-mono text-xs text-zinc-800 leading-relaxed">
                You must order <strong className="text-orange-700">{excessMeals}</strong> extra <strong className="capitalize">{entry.tag}</strong> meals to satisfy the caterer's minimum order requirement of <strong>{minOrder}</strong> (only <strong>{actualRsvps}</strong> RSVP'd). Do you want to randomly assign these to General attendees to prevent waste?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={assigning === entry.tag}
                  onClick={() => handleOptimizeYield(entry.tag, excessMeals)}
                  className="border-2 border-black bg-lime hover:bg-lime-dark text-black font-mono text-xs font-bold uppercase px-3 py-1.5 cursor-pointer shadow-[2px_2px_0_0_#000] active:translate-y-[1px] disabled:opacity-50"
                  data-testid={`yield-optimizer-yes-${entry.tag}`}
                >
                  {assigning === entry.tag ? "Assigning..." : "Yes, Assign Meals"}
                </button>
              </div>
            </div>
          );
        }
        return null;
      })}

      {/* Success details of assigned meals */}
      {assignedResult && (
        <div
          className="border-4 border-black bg-emerald-100 p-4 shadow-[4px_4px_0_0_#000]"
          data-testid="yield-optimizer-success"
        >
          <p className="font-mono text-xs font-bold text-emerald-900 mb-1">
            🎉 Successfully assigned {assignedResult.count} excess {assignedResult.tag} meals to General attendees:
          </p>
          <p className="font-mono text-[10px] text-emerald-800 leading-relaxed">
            {assignedResult.names.join(", ")}
          </p>
        </div>
      )}

      <details className="border-t border-gray-200 pt-3">
        <summary className="font-mono text-xs text-gray-500 cursor-pointer hover:text-gray-700">
          How is this forecast calculated?
        </summary>
        <div className="mt-2 space-y-1 font-mono text-xs text-gray-500 leading-relaxed">
          <p><strong>Current %</strong> = percentage of attending RSVPs with this tag.</p>
          <p><strong>Historical %</strong> = average across this club's past events (≥10 RSVPs).</p>
          <p>
            <strong>Blended %</strong> = (current × {Math.round(forecast.current_weight * 100)}%)
            + (historical × {Math.round(forecast.historical_weight * 100)}%).
            Current weight scales from 0% (0 RSVPs) to 100% (50+ RSVPs).
          </p>
          <p><strong>Forecast meals</strong> = round(blended % × venue capacity).</p>
        </div>
      </details>

      <CatererExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        eventId={forecast.event_id}
      />
    </div>
  );
}

function StatBox({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="neu-border bg-gray-50 p-3 text-center">
      <div className="flex items-center justify-center gap-1 text-gray-500">
        {icon}
        <span className="font-mono text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <p className="font-display text-xl font-black text-gray-900 mt-1">{value}</p>
    </div>
  );
}
