// =============================================================================
// File: src/components/shuttle/AutonomousShuttlePlatoonWidget.tsx
// Task: Dynamic "Carpool" Autonomous Shuttle Capacity Optimizer
// Description: Interactive neubrutalist UI for autonomous shuttle fleet management,
//              convoy platooning dispatch control, surge capacity analysis, and
//              aerodynamic energy efficiency monitoring.
// =============================================================================

import React, { useState } from "react";
import Bus from "lucide-react/dist/esm/icons/bus";
import Zap from "lucide-react/dist/esm/icons/zap";
import Users from "lucide-react/dist/esm/icons/users";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import Gauge from "lucide-react/dist/esm/icons/gauge";
import Battery from "lucide-react/dist/esm/icons/battery";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";

import {
  INITIAL_AUTONOMOUS_FLEET,
  evaluateSurgePlatoonDemand,
  createAutonomousPlatoon,
  disbandPlatoon,
  calculatePlatoonEfficiency,
  type AutonomousShuttleAsset,
  type PlatoonDispatchPlan,
} from "@/services/autonomousShuttlePlatoonService";

export interface AutonomousShuttlePlatoonWidgetProps {
  eventId?: string;
  eventName?: string;
  initialDemand?: number;
}

export const AutonomousShuttlePlatoonWidget: React.FC<AutonomousShuttlePlatoonWidgetProps> = ({
  eventId = "evt-surge-1",
  eventName = "Annual Campus Concert Let-Out",
  initialDemand = 38,
}) => {
  const [fleet, setFleet] = useState<AutonomousShuttleAsset[]>(INITIAL_AUTONOMOUS_FLEET);
  const [passengerDemand, setPassengerDemand] = useState<number>(initialDemand);
  const [activePlatoons, setActivePlatoons] = useState<PlatoonDispatchPlan[]>([]);
  const [notification, setNotification] = useState<string | null>(null);

  const surgeEval = evaluateSurgePlatoonDemand(passengerDemand, fleet);
  const efficiency = calculatePlatoonEfficiency(surgeEval.recommendedPlatoonSize);

  const handleDispatchPlatoon = () => {
    try {
      const newPlatoon = createAutonomousPlatoon(
        passengerDemand,
        "route-express-north",
        "North Campus Autonomous Express",
        "Main Plaza Station",
        "North Residential Quad",
        fleet
      );

      setActivePlatoons((prev) => [newPlatoon, ...prev]);
      setNotification(
        `🚀 Convoy Dispatched! ${newPlatoon.totalVehicles} Autonomous Units Coupled (${newPlatoon.totalCapacity} Seats, +${newPlatoon.energySavingsPct}% Energy Efficiency)`
      );
    } catch (err: any) {
      setNotification(`⚠️ Dispatch Failed: ${err.message}`);
    }
  };

  const handleDisbandPlatoon = (platoonId: string) => {
    const platoonToDisband = activePlatoons.find((p) => p.id === platoonId);
    if (!platoonToDisband) return;

    const updatedFleet = disbandPlatoon(platoonToDisband, fleet);
    setFleet(updatedFleet);
    setActivePlatoons((prev) => prev.filter((p) => p.id !== platoonId));
    setNotification(`🏁 Platoon ${platoonId.slice(0, 12)} completed trip and uncoupled.`);
  };

  return (
    <div
      className="neu-border border-4 border-black bg-sky-50 p-6 shadow-[6px_6px_0_0_#000] space-y-6 dark:bg-zinc-900 dark:border-sky-500"
      data-testid="autonomous-shuttle-platoon-widget"
    >
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-4 border-black pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="border-2 border-black bg-sky-300 text-black font-mono text-[10px] font-bold uppercase px-2.5 py-0.5 shadow-[1px_1px_0_0_#000]">
              Autonomous Asset Platooning
            </span>
            <span
              className="border-2 border-black bg-emerald-200 text-emerald-950 font-mono text-[10px] font-bold uppercase px-2 py-0.5"
              data-testid="platoon-efficiency-badge"
            >
              +{efficiency.energySavingsPct}% Energy Drafting
            </span>
          </div>
          <h2 className="font-display text-2xl font-black uppercase text-black dark:text-white flex items-center gap-2">
            <Bus className="h-6 w-6 text-sky-600" />
            Autonomous Shuttle Capacity Optimizer
          </h2>
          <p className="font-mono text-xs text-gray-700 dark:text-gray-300">
            Event: <strong className="text-black dark:text-white">{eventName}</strong> • Dynamic Convoy Platooning Engine
          </p>
        </div>

        <div className="border-2 border-black bg-amber-300 px-4 py-2 font-mono text-center shadow-[2px_2px_0_0_#000] shrink-0">
          <span className="text-[10px] font-bold uppercase text-amber-950 block">Surge Demand</span>
          <span className="font-display text-2xl font-black text-amber-950 flex items-center justify-center gap-1">
            <Users className="h-5 w-5" /> {passengerDemand} <span className="text-xs font-normal">riders</span>
          </span>
        </div>
      </div>

      {/* Notification Toast Banner */}
      {notification && (
        <div
          className="border-2 border-black bg-emerald-100 p-3 font-mono text-xs font-bold text-emerald-950 shadow-[2px_2px_0_0_#000] flex items-center justify-between"
          data-testid="platoon-notification-banner"
        >
          <span>{notification}</span>
          <button
            onClick={() => setNotification(null)}
            className="text-black hover:underline text-[10px] uppercase font-mono ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Demand Slider & Platoon Optimizer Controller */}
      <div className="border-2 border-black bg-white p-4 space-y-4 shadow-[4px_4px_0_0_#000] dark:bg-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className="font-mono text-xs font-black uppercase text-black dark:text-white flex items-center gap-1.5">
            <Gauge className="h-4 w-4 text-sky-600" />
            Simulate Event Surge Demand (Waiting Attendees):
          </label>
          <span className="font-mono text-xs font-bold text-purple-900 bg-purple-100 border border-black px-2 py-0.5">
            Recommended Convoy Size: {surgeEval.recommendedPlatoonSize} Units ({surgeEval.recommendedPlatoonSize * 14} Seats)
          </span>
        </div>

        <div className="flex items-center gap-4">
          <input
            type="range"
            min="10"
            max="70"
            step="1"
            value={passengerDemand}
            onChange={(e) => setPassengerDemand(Number(e.target.value))}
            className="flex-1 accent-sky-600 cursor-pointer h-2 bg-gray-200 rounded"
            data-testid="surge-demand-slider"
          />
          <span className="font-mono text-sm font-black w-12 text-center bg-gray-100 border-2 border-black py-1">
            {passengerDemand}
          </span>
        </div>

        {/* Efficiency Analytics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="border-2 border-black bg-sky-100 p-3 font-mono shadow-[2px_2px_0_0_#000]">
            <span className="text-[10px] font-bold uppercase text-sky-900 block">Energy Efficiency</span>
            <span className="font-display text-lg font-black text-sky-950 flex items-center gap-1">
              <Zap className="h-4 w-4 fill-sky-950" /> +{efficiency.energySavingsPct}% Saved
            </span>
            <span className="text-[9px] text-sky-800">Aerodynamic drafting gain</span>
          </div>

          <div className="border-2 border-black bg-emerald-100 p-3 font-mono shadow-[2px_2px_0_0_#000]">
            <span className="text-[10px] font-bold uppercase text-emerald-900 block">Passenger Throughput</span>
            <span className="font-display text-lg font-black text-emerald-950">
              {efficiency.throughputMultiplier}x Multiplier
            </span>
            <span className="text-[9px] text-emerald-800">Synchronized stop arrival</span>
          </div>

          <div className="border-2 border-black bg-purple-100 p-3 font-mono shadow-[2px_2px_0_0_#000]">
            <span className="text-[10px] font-bold uppercase text-purple-900 block">CO₂ Offset Rate</span>
            <span className="font-display text-lg font-black text-purple-950">
              -{efficiency.co2ReductionKgPerHour} kg/hr
            </span>
            <span className="text-[9px] text-purple-800">Reduced fleet power draw</span>
          </div>
        </div>

        {/* Dispatch Trigger Button */}
        <button
          type="button"
          onClick={handleDispatchPlatoon}
          disabled={!surgeEval.canFormPlatoon}
          className="w-full border-2 border-black bg-sky-400 hover:bg-sky-500 text-black font-mono text-xs font-black uppercase py-3 shadow-[3px_3px_0_0_#000] active:translate-y-[1px] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-all"
          data-testid="dispatch-platoon-btn"
        >
          <Sparkles className="h-4 w-4" />
          Dispatch Autonomous Platoon Convoy ({surgeEval.recommendedPlatoonSize} Coupled AVs)
        </button>
      </div>

      {/* Active Platoons Display */}
      {activePlatoons.length > 0 && (
        <div className="space-y-3" data-testid="active-platoons-list">
          <h3 className="font-display text-base font-black uppercase text-black dark:text-white flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Active En-Route Platooning Convoys ({activePlatoons.length})
          </h3>

          <div className="grid grid-cols-1 gap-3">
            {activePlatoons.map((platoon) => (
              <div
                key={platoon.id}
                className="neu-border border-4 border-black bg-white p-4 shadow-[4px_4px_0_0_#000] space-y-3 dark:bg-zinc-800"
                data-testid={`platoon-card-${platoon.id}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black pb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="bg-black text-white font-mono text-[10px] font-bold uppercase px-2 py-0.5">
                        Platoon Active
                      </span>
                      <span className="font-mono text-xs font-bold text-sky-900">
                        {platoon.routeName}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-gray-700 dark:text-gray-300 mt-0.5">
                      Pickup: <strong>{platoon.pickupStop}</strong> → Dropoff: <strong>{platoon.dropoffStop}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="border border-black bg-emerald-200 text-emerald-950 font-mono text-xs font-bold px-2 py-1">
                      {platoon.totalCapacity} Seats Capacity
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDisbandPlatoon(platoon.id)}
                      className="border-2 border-black bg-rose-300 hover:bg-rose-400 text-black font-mono text-[11px] font-bold uppercase px-3 py-1 shadow-[1px_1px_0_0_#000] cursor-pointer"
                      data-testid={`disband-platoon-btn-${platoon.id}`}
                    >
                      Complete & Disband
                    </button>
                  </div>
                </div>

                {/* Coupled Vehicles List */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="border-2 border-black bg-amber-100 p-2 font-mono text-xs shadow-[1px_1px_0_0_#000]">
                    <span className="font-bold text-amber-950 text-[10px] uppercase block">
                      Lead Vehicle (Leader)
                    </span>
                    <span className="font-bold text-black block truncate">{platoon.leadVehicle.name}</span>
                    <span className="text-[10px] text-gray-700">Battery: {platoon.leadVehicle.batteryPct}%</span>
                  </div>

                  {platoon.followerVehicles.map((follower, idx) => (
                    <div
                      key={follower.id}
                      className="border-2 border-black bg-sky-100 p-2 font-mono text-xs shadow-[1px_1px_0_0_#000]"
                    >
                      <span className="font-bold text-sky-950 text-[10px] uppercase block">
                        Follower Unit #{idx + 1} ({platoon.headwayMeters}m Gap)
                      </span>
                      <span className="font-bold text-black block truncate">{follower.name}</span>
                      <span className="text-[10px] text-gray-700">Battery: {follower.batteryPct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Autonomous Fleet Asset Status Grid */}
      <div className="space-y-3">
        <h3 className="font-display text-base font-black uppercase text-black dark:text-white flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-sky-600" />
          Autonomous Fleet Asset Readiness Matrix ({fleet.length} Units)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {fleet.map((asset) => {
            const isEligible = asset.batteryPct >= 20 && asset.status === "available";
            return (
              <div
                key={asset.id}
                className={`border-2 border-black p-3 font-mono text-xs space-y-1.5 shadow-[2px_2px_0_0_#000] ${
                  asset.status === "in_platoon"
                    ? "bg-purple-100"
                    : isEligible
                    ? "bg-white dark:bg-zinc-800"
                    : "bg-gray-100 opacity-75"
                }`}
                data-testid={`fleet-asset-card-${asset.id}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-black dark:text-white truncate">{asset.name}</span>
                  <span
                    className={`text-[9px] font-bold uppercase px-1.5 py-0.5 border border-black ${
                      asset.status === "in_platoon"
                        ? "bg-purple-300 text-purple-950"
                        : asset.status === "available"
                        ? "bg-emerald-300 text-emerald-950"
                        : "bg-amber-300 text-amber-950"
                    }`}
                  >
                    {asset.status.replace("_", " ")}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1 text-gray-700 dark:text-gray-300">
                    <Battery className="h-3.5 w-3.5 text-emerald-600" /> {asset.batteryPct}% Charge
                  </span>
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    Cap: {asset.capacity} seats
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
