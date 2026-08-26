import React, { useState } from "react";
import {
  Leaf,
  Zap,
  Bus,
  Utensils,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Award,
  TrendingDown,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import {
  CateringType,
  CarbonFootprintResult,
  calculateEventCarbonFootprint,
  getGreenBadgeStatus,
  AVAILABLE_SUSTAINABLE_MITIGATIONS,
} from "@/lib/eventCarbonEstimator";
import { cn } from "@/lib/utils";

export interface EventCarbonEstimatorProps {
  eventId?: string;
  eventTitle?: string;
  initialVenueSqft?: number;
  initialDurationHours?: number;
  initialAttendeeCount?: number;
  initialCateringType?: CateringType;
  initialMitigations?: string[];
  isOrganizer?: boolean;
  onSaveMitigations?: (mitigations: string[], result: CarbonFootprintResult) => void;
  className?: string;
}

export const EventCarbonEstimator: React.FC<EventCarbonEstimatorProps> = ({
  eventId = "evt-1",
  eventTitle = "Annual Campus Tech Gala 2026",
  initialVenueSqft = 1200,
  initialDurationHours = 3,
  initialAttendeeCount = 80,
  initialCateringType = "vegetarian",
  initialMitigations = ["zero_waste_packaging", "digital_collateral"],
  isOrganizer = true,
  onSaveMitigations,
  className,
}) => {
  const [venueSqft, setVenueSqft] = useState<number>(initialVenueSqft);
  const [durationHours, setDurationHours] = useState<number>(initialDurationHours);
  const [attendeeCount, setAttendeeCount] = useState<number>(initialAttendeeCount);
  const [cateringType, setCateringType] = useState<CateringType>(initialCateringType);
  const [selectedMitigations, setSelectedMitigations] = useState<string[]>(initialMitigations);

  const footprint: CarbonFootprintResult = calculateEventCarbonFootprint({
    venueSqft,
    durationHours,
    attendeeCount,
    cateringType,
    mitigations: selectedMitigations,
  });

  const badge = getGreenBadgeStatus(footprint.co2PerAttendeeKg);

  const handleToggleMitigation = (mitigationId: string) => {
    const next = selectedMitigations.includes(mitigationId)
      ? selectedMitigations.filter((id) => id !== mitigationId)
      : [...selectedMitigations, mitigationId];

    setSelectedMitigations(next);
    if (onSaveMitigations) {
      const updatedFootprint = calculateEventCarbonFootprint({
        venueSqft,
        durationHours,
        attendeeCount,
        cateringType,
        mitigations: next,
      });
      onSaveMitigations(next, updatedFootprint);
    }
  };

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Header Bar */}
      <div className="p-5 bg-emerald-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-emerald-950">
            <Leaf className="w-5 h-5 text-emerald-700 fill-emerald-600" />
            <span>Event Carbon Footprint Estimator — {eventTitle}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Algorithmic ecological impact analysis. Incentivizing zero-waste and green campus planning.
          </p>
        </div>

        {/* Public Green Event Badge (#3590) */}
        <div
          data-testid="green-event-badge"
          className={cn(
            "px-3.5 py-1.5 border-2 border-black rounded-lg text-xs uppercase flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
            badge.badgeClass
          )}
        >
          <Award className="w-4 h-4 text-emerald-600" />
          <span>{badge.label}</span>
        </div>
      </div>

      {/* Carbon Metrics Summary Banner */}
      <div className="p-5 bg-emerald-50/70 border-b-2 border-black grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-3 bg-white border-2 border-black rounded-lg text-center space-y-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[10px] font-bold text-gray-500 uppercase">Total Footprint</span>
          <div className="font-black text-lg text-black">{footprint.totalCo2Kg} kg</div>
          <span className="text-[11px] text-gray-600 font-sans">({footprint.totalCo2Tons} Tons CO2e)</span>
        </div>

        <div className="p-3 bg-white border-2 border-black rounded-lg text-center space-y-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[10px] font-bold text-gray-500 uppercase">Per Attendee</span>
          <div className="font-black text-lg text-black">{footprint.co2PerAttendeeKg} kg</div>
          <span className="text-[11px] font-sans text-emerald-700 font-bold">
            {footprint.isGreenCertified ? "Under 1.5kg target" : "Target: <= 1.5kg"}
          </span>
        </div>

        <div className="p-3 bg-white border-2 border-black rounded-lg text-center space-y-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[10px] font-bold text-gray-500 uppercase">Mitigation Savings</span>
          <div className="font-black text-lg text-emerald-700">-{footprint.mitigationSavingsKg} kg</div>
          <span className="text-[11px] text-emerald-700 font-sans font-bold flex items-center justify-center gap-0.5">
            <TrendingDown className="w-3 h-3" /> Reduced
          </span>
        </div>

        <div className="p-3 bg-white border-2 border-black rounded-lg text-center space-y-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[10px] font-bold text-gray-500 uppercase">Sustainability Score</span>
          <div className="font-black text-lg text-purple-900">{footprint.sustainabilityScore}/100</div>
          <span className="text-[11px] text-purple-700 font-sans font-bold">
            {footprint.sustainabilityScore >= 85 ? "Grade A (Eco-Friendly)" : "Grade B (Standard)"}
          </span>
        </div>
      </div>

      {/* Main Grid: Emissions Source Breakdown & Sustainable Mitigations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
        {/* Source Breakdown */}
        <div className="p-5 border-b-2 lg:border-b-0 lg:border-r-2 border-black space-y-4 bg-white">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            Emissions Source Breakdown
          </h4>

          <div className="space-y-3 font-sans text-xs">
            {/* Venue HVAC */}
            <div className="p-3.5 border-2 border-black rounded-lg bg-amber-50/60 space-y-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1.5 text-amber-950 font-mono">
                  <Zap className="w-4 h-4 text-amber-600" /> Venue HVAC & Lighting
                </span>
                <span className="font-mono text-black">{footprint.venueCo2Kg} kg CO2</span>
              </div>
              <p className="text-[11px] text-gray-600">
                Calculated for {venueSqft} sqft space over {durationHours} hours ({Math.round(venueSqft * durationHours * 0.12)} kg base).
              </p>
            </div>

            {/* Attendee Transit */}
            <div className="p-3.5 border-2 border-black rounded-lg bg-sky-50/60 space-y-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1.5 text-sky-950 font-mono">
                  <Bus className="w-4 h-4 text-sky-600" /> Attendee Travel & Commute
                </span>
                <span className="font-mono text-black">{footprint.transitCo2Kg} kg CO2</span>
              </div>
              <p className="text-[11px] text-gray-600">
                Based on {attendeeCount} RSVPs (35% commuters via car/transit, 65% campus dorm walking/biking).
              </p>
            </div>

            {/* Catering & Food */}
            <div className="p-3.5 border-2 border-black rounded-lg bg-emerald-50/60 space-y-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1.5 text-emerald-950 font-mono">
                  <Utensils className="w-4 h-4 text-emerald-600" /> Catering & Food Sourcing
                </span>
                <span className="font-mono text-black">{footprint.cateringCo2Kg} kg CO2</span>
              </div>
              <p className="text-[11px] text-gray-600">
                Menu selection: <strong className="capitalize">{cateringType}</strong> ({cateringType === "vegan" ? "0.5kg" : cateringType === "vegetarian" ? "1.2kg" : "3.5kg"} CO2/attendee).
              </p>
            </div>
          </div>
        </div>

        {/* Sustainable Mitigations Checklist (#3590) */}
        <div className="p-5 bg-slate-50 space-y-3.5">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Sustainable Mitigations & Action Plan
            </h4>
            <span className="text-[11px] text-gray-500 font-sans">Toggle to unlock badge</span>
          </div>

          <p className="text-xs font-sans text-gray-600">
            Applying mitigations reduces total CO2 and helps your event achieve the campus <strong>🌱 Green Event Badge</strong>.
          </p>

          <div className="space-y-2.5">
            {AVAILABLE_SUSTAINABLE_MITIGATIONS.map((m) => {
              const isChecked = selectedMitigations.includes(m.id);

              return (
                <div
                  key={m.id}
                  onClick={() => handleToggleMitigation(m.id)}
                  className={cn(
                    "p-3 border-2 rounded-lg cursor-pointer transition-all duration-200 flex items-center justify-between shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
                    isChecked
                      ? "border-black bg-emerald-50 ring-1 ring-emerald-400"
                      : "border-gray-300 bg-white hover:border-gray-500"
                  )}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-black">{m.label}</span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">
                        -{m.reductionPercent}% CO2
                      </span>
                    </div>
                    <p className="text-[11px] font-sans text-gray-600">{m.description}</p>
                  </div>

                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="w-4 h-4 accent-emerald-600 cursor-pointer"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
