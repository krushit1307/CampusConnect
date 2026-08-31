import React, { useState, useMemo } from "react";
import Thermometer from "lucide-react/dist/esm/icons/thermometer";
import Users from "lucide-react/dist/esm/icons/users";
import Flame from "lucide-react/dist/esm/icons/flame";
import Clock from "lucide-react/dist/esm/icons/clock";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Cpu from "lucide-react/dist/esm/icons/cpu";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Sliders from "lucide-react/dist/esm/icons/sliders";
import Sun from "lucide-react/dist/esm/icons/sun";
import Zap from "lucide-react/dist/esm/icons/zap";

import {
  HvacPreCoolingModelService,
  HvacPredictionResult,
} from "@/services/hvacPreCoolingModelService";

interface HvacPreCoolingPredictionCardProps {
  venueId?: string;
  initialAttendees?: number;
  initialVenueAreaSqFt?: number;
  eventStartTime?: string;
}

export const HvacPreCoolingPredictionCard: React.FC<HvacPreCoolingPredictionCardProps> = ({
  venueId = "venue-main-auditorium",
  initialAttendees = 1200,
  initialVenueAreaSqFt = 5000,
  eventStartTime = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
}) => {
  const [attendees, setAttendees] = useState<number>(initialAttendees);
  const [venueArea, setVenueArea] = useState<number>(initialVenueAreaSqFt);
  const [outdoorTemp, setOutdoorTemp] = useState<number>(88);
  const [targetTemp, setTargetTemp] = useState<number>(68);
  const [hvacCapacity, setHvacCapacity] = useState<number>(120000); // 10 Tons (120k BTU/hr)

  const [bacnetOutput, setBacnetOutput] = useState<string | null>(null);

  // Compute thermal prediction model
  const prediction: HvacPredictionResult = useMemo(() => {
    try {
      return HvacPreCoolingModelService.predictPreCooling({
        attendeeCount: attendees,
        venueAreaSqFt: venueArea,
        venueHeightFt: 12,
        eventStartTime,
        outdoorTemperatureF: outdoorTemp,
        currentIndoorTemperatureF: 72,
        targetTemperatureF: targetTemp,
        hvacCapacityBtuPerHour: hvacCapacity,
      });
    } catch (err: any) {
      // Fallback safe defaults if invalid input
      return HvacPreCoolingModelService.predictPreCooling({
        attendeeCount: 100,
        venueAreaSqFt: 5000,
        eventStartTime,
      });
    }
  }, [attendees, venueArea, outdoorTemp, targetTemp, hvacCapacity, eventStartTime]);

  const handleSimulateBacnetDispatch = () => {
    const res = HvacPreCoolingModelService.simulateBacnetCommand(venueId, prediction);
    setBacnetOutput(res.message);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 text-slate-100 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-cyan-500/10 rounded-2xl border border-cyan-500/20 text-cyan-400">
            <Thermometer className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold tracking-tight text-white">
                HVAC Pre-Cooling Predictive Thermal Model
              </h3>
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                RESOURCE CONSTRAINT ANALYTICS
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Predictive human heat-load estimation & 6-hour optimal pre-cooling start time
              calculation.
            </p>
          </div>
        </div>

        {/* Constraint Level Badge */}
        <span
          data-testid="resource-constraint-badge"
          className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold uppercase border ${
            prediction.resourceConstraintLevel === "critical"
              ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
              : prediction.resourceConstraintLevel === "high"
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : prediction.resourceConstraintLevel === "moderate"
                  ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                  : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
          }`}
        >
          {prediction.resourceConstraintLevel} CONSTRAINT
        </span>
      </div>

      {/* Critical Resource Constraint Warning Banner */}
      {prediction.warningMessage && (
        <div
          role="alert"
          data-testid="hvac-warning-banner"
          className="p-4 bg-rose-950/80 border-2 border-rose-500 text-rose-100 rounded-xl space-y-1 shadow-lg animate-pulse"
        >
          <div className="flex items-center gap-2 text-rose-300 font-extrabold text-xs uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>HIGH RESOURCE CONSTRAINT DETECTED</span>
          </div>
          <p className="font-mono text-xs leading-relaxed">{prediction.warningMessage}</p>
        </div>
      )}

      {/* Interactive Inputs & Sliders */}
      <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-900 pb-2">
          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" /> Interactive Model Parameters
          </h4>
          <span className="text-[10px] text-slate-500 font-mono">Real-Time Estimator</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          {/* RSVP Attendees Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between font-mono">
              <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-400" /> RSVP Attendance:
              </span>
              <span className="font-bold text-white" data-testid="attendees-count-val">
                {attendees.toLocaleString()} people
              </span>
            </div>
            <input
              type="range"
              min={50}
              max={5000}
              step={50}
              value={attendees}
              onChange={(e) => setAttendees(Number(e.target.value))}
              data-testid="attendees-slider"
              className="w-full accent-cyan-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
          </div>

          {/* Outdoor Temperature Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between font-mono">
              <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-400" /> Outdoor Weather Forecast:
              </span>
              <span className="font-bold text-amber-300">{outdoorTemp}°F</span>
            </div>
            <input
              type="range"
              min={60}
              max={110}
              step={1}
              value={outdoorTemp}
              onChange={(e) => setOutdoorTemp(Number(e.target.value))}
              data-testid="outdoor-temp-slider"
              className="w-full accent-amber-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
          </div>

          {/* Venue Area */}
          <div className="space-y-1">
            <label className="text-slate-400 font-mono font-semibold block text-[11px]">
              Venue Floor Area (sq ft)
            </label>
            <input
              type="number"
              value={venueArea}
              onChange={(e) => setVenueArea(Number(e.target.value))}
              data-testid="venue-area-input"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              min={100}
            />
          </div>

          {/* HVAC Capacity */}
          <div className="space-y-1">
            <label className="text-slate-400 font-mono font-semibold block text-[11px]">
              HVAC Cooling Capacity (BTU/hr)
            </label>
            <input
              type="number"
              value={hvacCapacity}
              onChange={(e) => setHvacCapacity(Number(e.target.value))}
              data-testid="hvac-capacity-input"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              step={10000}
              min={10000}
            />
          </div>
        </div>
      </div>

      {/* Model Predictions & Pre-Cooling Recommendation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Heat Load Breakdown */}
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3 font-mono text-xs">
          <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-rose-400" /> Estimated Thermal Load Breakdown
          </span>

          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between items-center py-1 border-b border-slate-900">
              <span className="text-slate-400">Human Heat Output (400 BTU/person):</span>
              <span className="font-bold text-rose-400">
                +{prediction.breakdown.humanHeatLoadBtu.toLocaleString()} BTU/hr
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-900">
              <span className="text-slate-400">Lighting & Tech Load:</span>
              <span className="font-bold text-amber-400">
                +{prediction.breakdown.equipmentHeatLoadBtu.toLocaleString()} BTU/hr
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-900">
              <span className="text-slate-400">Outdoor Heat Gain:</span>
              <span className="font-bold text-orange-400">
                +{prediction.breakdown.outdoorGainBtu.toLocaleString()} BTU/hr
              </span>
            </div>

            <div className="flex justify-between items-center py-1.5 font-bold text-xs pt-2">
              <span className="text-white">Total Peak Cooling Demand:</span>
              <span className="text-cyan-300 text-sm" data-testid="cooling-demand-val">
                {prediction.estimatedCoolingDemandBtuPerHour.toLocaleString()} BTU/hr
              </span>
            </div>
          </div>
        </div>

        {/* 6-Hour Pre-Cooling Schedule Recommendation */}
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3 font-mono text-xs flex flex-col justify-between">
          <div>
            <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" /> Pre-Cooling Schedule Recommendation
            </span>

            <div className="mt-3 space-y-2 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Recommended Pre-Cooling Duration:</span>
                <span
                  className="font-bold text-cyan-300 text-sm"
                  data-testid="precooling-duration-val"
                >
                  {prediction.recommendedPreCoolingDurationHours} hours (
                  {prediction.recommendedPreCoolingMinutes} min)
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400">Recommended Start Time:</span>
                <span
                  className="font-bold text-emerald-400 text-sm"
                  data-testid="precooling-start-time-val"
                >
                  {new Date(prediction.recommendedStartTime).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400">Predicted Peak Temp (Unmitigated):</span>
                <span className="font-bold text-rose-400">
                  {prediction.predictedPeakTemperatureF}°F
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleSimulateBacnetDispatch}
            data-testid="btn-dispatch-bacnet"
            className="w-full py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs rounded-xl shadow-lg shadow-cyan-600/20 flex items-center justify-center gap-2 transition"
          >
            <Cpu className="w-4 h-4" /> Simulate BACnet Pre-Cooling Command
          </button>
        </div>
      </div>

      {/* BACnet Command Output Box */}
      {bacnetOutput && (
        <div
          role="status"
          data-testid="bacnet-dispatch-output"
          className="p-4 bg-cyan-950/80 border border-cyan-500/40 text-cyan-200 rounded-xl font-mono text-xs space-y-1 animate-in fade-in"
        >
          <div className="flex items-center gap-2 text-cyan-400 font-bold border-b border-cyan-800/80 pb-1.5">
            <Zap className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>BACnet Simulation Control Adapter Output</span>
          </div>
          <p className="pt-1 leading-relaxed">{bacnetOutput}</p>
        </div>
      )}
    </div>
  );
};
