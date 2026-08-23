// =============================================================================
// File: src/components/capacity/VenueEgressSimulatorPanel.tsx
// Issue: #4283 - Build a 'Real-Time "Event Capacity" Thermal Map'
// Description: Emergency egress flow & fire evacuation transit simulation panel,
//              exit portal throughput modeling, and bottleneck choke-point analyzer.
// =============================================================================

import React, { useState, useMemo } from "react";
import {
  ShieldAlert,
  Flame,
  DoorOpen,
  Clock,
  Activity,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  Wind,
  Navigation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VenueZone } from "@/types/capacityThermalMap";

interface VenueEgressSimulatorPanelProps {
  zones: VenueZone[];
  onTriggerEvacuationDrill?: (zoneId: string) => void;
}

export interface ExitPortal {
  id: string;
  name: string;
  zoneId: string;
  widthMeters: number;
  maxThroughputPerMin: number;
  currentFlowPerMin: number;
  isObstacleReported: boolean;
  status: "CLEAR" | "BUSY" | "BLOCKED";
}

export const VenueEgressSimulatorPanel: React.FC<VenueEgressSimulatorPanelProps> = ({
  zones,
  onTriggerEvacuationDrill,
}) => {
  const [selectedExitZoneId, setSelectedExitZoneId] = useState<string>(zones[0]?.id || "zone-gym-a");
  const [drillActive, setDrillActive] = useState<boolean>(false);
  const [simulatedMinutesElapsed, setSimulatedMinutesElapsed] = useState<number>(0);

  // Mock Exit Portals for venue
  const exitPortals: ExitPortal[] = useMemo(() => {
    return [
      {
        id: "exit-north-01",
        name: "North Double Fire Doors (Portal A1)",
        zoneId: "zone-gym-a",
        widthMeters: 3.2,
        maxThroughputPerMin: 140,
        currentFlowPerMin: 45,
        isObstacleReported: false,
        status: "CLEAR",
      },
      {
        id: "exit-west-02",
        name: "West Emergency Breezeway (Portal A2)",
        zoneId: "zone-gym-a",
        widthMeters: 2.4,
        maxThroughputPerMin: 110,
        currentFlowPerMin: 68,
        isObstacleReported: true,
        status: "BUSY",
      },
      {
        id: "exit-center-03",
        name: "Main Concourse Atrium Turnstiles",
        zoneId: "zone-gym-b",
        widthMeters: 4.8,
        maxThroughputPerMin: 220,
        currentFlowPerMin: 80,
        isObstacleReported: false,
        status: "CLEAR",
      },
      {
        id: "exit-south-04",
        name: "South Loading Bay Rollup (Portal C1)",
        zoneId: "zone-gym-c",
        widthMeters: 5.0,
        maxThroughputPerMin: 250,
        currentFlowPerMin: 22,
        isObstacleReported: false,
        status: "CLEAR",
      },
    ];
  }, []);

  const activeZone = zones.find((z) => z.id === selectedExitZoneId) || zones[0];
  const relevantExits = exitPortals.filter((ep) => ep.zoneId === activeZone.id);
  const totalExitThroughput = relevantExits.reduce((sum, ep) => sum + ep.maxThroughputPerMin, 0);

  // Estimated evacuation duration (minutes = headCount / totalThroughput)
  const estimatedEvacuationMinutes =
    totalExitThroughput > 0
      ? Number((activeZone.currentOccupancyCount / totalExitThroughput).toFixed(1))
      : 99.0;

  const isEgressCompliant = estimatedEvacuationMinutes <= 4.0; // NFPA standard is < 4 mins

  const handleStartDrill = () => {
    setDrillActive(true);
    setSimulatedMinutesElapsed(0);
    onTriggerEvacuationDrill?.(activeZone.id);
  };

  return (
    <div className="neu-border bg-white p-6 dark:bg-zinc-900 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b-2 border-black pb-4 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center border-2 border-black bg-amber-400 text-black">
            <DoorOpen className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase text-zinc-900 dark:text-white">
              Emergency Egress & Choke-Point Simulator
            </h3>
            <p className="font-mono text-xs text-zinc-500">
              NFPA 101 Life Safety Code Compliance & Total Evacuation Transit Modeler
            </p>
          </div>
        </div>

        {/* Zone Selector */}
        <select
          aria-label="Select Venue Zone for Egress Modeling"
          value={selectedExitZoneId}
          onChange={(e) => setSelectedExitZoneId(e.target.value)}
          className="neu-border bg-zinc-50 px-3 py-1.5 font-mono text-xs font-bold text-zinc-800 dark:bg-zinc-800 dark:text-white"
        >
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name} ({z.currentOccupancyCount} ppl)
            </option>
          ))}
        </select>
      </div>

      {/* Evacuation Duration Meter */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="neu-border bg-zinc-50 p-4 dark:bg-zinc-800">
          <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
            Estimated Full Evacuation Time
          </span>
          <div
            className={`mt-1 font-mono text-2xl font-black ${
              isEgressCompliant ? "text-emerald-600" : "text-rose-600 animate-pulse"
            }`}
          >
            {estimatedEvacuationMinutes} Minutes
          </div>
          <span className="font-mono text-[10px] text-zinc-500">
            {isEgressCompliant ? "NFPA Standard Compliant (<4.0m)" : "Non-compliant! Bottleneck risk"}
          </span>
        </div>

        <div className="neu-border bg-zinc-50 p-4 dark:bg-zinc-800">
          <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
            Combined Exit Capacity
          </span>
          <div className="mt-1 font-mono text-2xl font-black text-blue-600 dark:text-blue-400">
            {totalExitThroughput} ppl / min
          </div>
          <span className="font-mono text-[10px] text-zinc-500">
            Across {relevantExits.length} Dedicated Emergency Doors
          </span>
        </div>

        <div className="neu-border bg-zinc-50 p-4 dark:bg-zinc-800">
          <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
            Choke-Point Risk Rating
          </span>
          <div
            className={`mt-1 font-mono text-2xl font-black ${
              activeZone.occupancyPercentage > 100 ? "text-rose-600" : "text-emerald-600"
            }`}
          >
            {activeZone.occupancyPercentage > 100 ? "HIGH RISK" : "NORMAL"}
          </div>
          <span className="font-mono text-[10px] text-zinc-500">
            {activeZone.currentOccupancyCount} attendees in {activeZone.areaSquareMeters} m²
          </span>
        </div>
      </div>

      {/* Exit Door Status Table */}
      <div>
        <h4 className="mb-2 font-mono text-xs font-black uppercase text-zinc-700 dark:text-zinc-300">
          Designated Emergency Exit Portals ({relevantExits.length})
        </h4>
        <div className="neu-border overflow-hidden bg-zinc-50 dark:bg-zinc-800">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900">
              <tr>
                <th className="p-2.5">Exit Portal</th>
                <th className="p-2.5">Door Width</th>
                <th className="p-2.5 text-right">Max Flow</th>
                <th className="p-2.5 text-right">Current Flow</th>
                <th className="p-2.5 text-center">Pathway Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {relevantExits.map((ep) => (
                <tr key={ep.id}>
                  <td className="p-2.5 font-bold text-zinc-900 dark:text-white">{ep.name}</td>
                  <td className="p-2.5 text-zinc-500">{ep.widthMeters} meters</td>
                  <td className="p-2.5 text-right font-bold text-blue-600">
                    {ep.maxThroughputPerMin} ppl/min
                  </td>
                  <td className="p-2.5 text-right font-bold">{ep.currentFlowPerMin} ppl/min</td>
                  <td className="p-2.5 text-center">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-black uppercase ${
                        ep.status === "CLEAR"
                          ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                          : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                      }`}
                    >
                      {ep.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default VenueEgressSimulatorPanel;
