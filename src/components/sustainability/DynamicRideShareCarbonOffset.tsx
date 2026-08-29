// =============================================================================
// File: src/components/sustainability/DynamicRideShareCarbonOffset.tsx
// Issue: #3936 - Develop a 'Dynamic Ride-Share Carbon Offset' Calculator
// Description: Interactive carbon offset dashboard, live trip emissions simulator,
//              ecological equivalency gauges, and club sustainability leaderboard.
// =============================================================================

import React, { useState, useMemo } from "react";
import {
  Leaf,
  Car,
  Trees,
  BatteryCharging,
  Fuel,
  Zap,
  Award,
  TrendingUp,
  Download,
  Plus,
  Compass,
  MapPin,
  Users,
  CheckCircle2,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  RideShareTrip,
  VehicleFuelType,
  GeoLocation,
} from "@/types/carbonOffset";
import {
  CAMPUS_GEO_PRESETS,
  calculateHaversineDistanceMiles,
  calculateTripCarbonOffset,
  calculateGlobalImpactSummary,
  getClubEcoLeaderboard,
  getMockRideShareTrips,
  exportSustainabilityAuditCSV,
  recordRideShareOffset,
} from "@/services/carbonOffsetService";

interface DynamicRideShareCarbonOffsetProps {
  initialTrips?: RideShareTrip[];
  userClubId?: string;
  userClubName?: string;
}

export const DynamicRideShareCarbonOffset: React.FC<DynamicRideShareCarbonOffsetProps> = ({
  initialTrips,
  userClubId = "club-acm-1",
  userClubName = "ACM Student Chapter",
}) => {
  const [trips, setTrips] = useState<RideShareTrip[]>(initialTrips || getMockRideShareTrips());
  const [activeTab, setActiveTab] = useState("simulator");

  // Simulator form state
  const [selectedOrigin, setSelectedOrigin] = useState<GeoLocation>(CAMPUS_GEO_PRESETS[0]);
  const [selectedDest, setSelectedDest] = useState<GeoLocation>(CAMPUS_GEO_PRESETS[3]);
  const [customDistance, setCustomDistance] = useState<number>(15);
  const [riderCount, setRiderCount] = useState<number>(3);
  const [vehicleType, setVehicleType] = useState<VehicleFuelType>("gasoline_sedan");
  const [isLogging, setIsLogging] = useState(false);
  const [logSuccess, setLogSuccess] = useState(false);

  // Derived distances & emissions for simulator
  const calculatedDistance = useMemo(() => {
    return calculateHaversineDistanceMiles(
      selectedOrigin.latitude,
      selectedOrigin.longitude,
      selectedDest.latitude,
      selectedDest.longitude
    );
  }, [selectedOrigin, selectedDest]);

  const activeDistance = calculatedDistance > 0 ? calculatedDistance : customDistance;

  const currentSimulatedOffset = useMemo(() => {
    return calculateTripCarbonOffset(activeDistance, riderCount, vehicleType);
  }, [activeDistance, riderCount, vehicleType]);

  // Derived global summary & leaderboard
  const globalSummary = useMemo(() => {
    return calculateGlobalImpactSummary(trips);
  }, [trips]);

  const leaderboard = useMemo(() => {
    return getClubEcoLeaderboard(trips);
  }, [trips]);

  // Log completed ride handler
  const handleLogTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLogging(true);

    const newTrip: RideShareTrip = {
      id: `trip-${Date.now()}`,
      eventId: "evt-custom-01",
      eventTitle: "Campus Connect Community Carpool",
      clubId: userClubId,
      clubName: userClubName,
      driverId: "usr-current",
      driverName: "You (Active Driver)",
      origin: selectedOrigin,
      destination: selectedDest,
      distanceMiles: activeDistance,
      distanceKm: Number((activeDistance * 1.60934).toFixed(1)),
      riderCount,
      vehicleType,
      completedAt: new Date().toISOString(),
      co2SavedGrams: currentSimulatedOffset.co2SavedGrams,
      co2SavedPounds: currentSimulatedOffset.co2SavedPounds,
      co2SavedKg: currentSimulatedOffset.co2SavedKg,
    };

    await recordRideShareOffset(newTrip);
    setTrips((prev) => [newTrip, ...prev]);
    setIsLogging(false);
    setLogSuccess(true);
    setTimeout(() => setLogSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Global Impact Counter */}
      <div className="neu-border bg-white p-6 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center border-2 border-black bg-lime dark:bg-lime-400">
                <Leaf className="h-5 w-5 text-black" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                Dynamic Ride-Share Carbon Offset Engine
              </h2>
            </div>
            <p className="mt-1 font-mono text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              EPA-Standard Greenhouse Gas Emissions Counter & Ecological Equivalency Tracker
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportSustainabilityAuditCSV(globalSummary, trips)}
              className="neu-border flex items-center gap-1.5 bg-lime font-mono text-xs font-bold uppercase text-black hover:bg-lime/80"
            >
              <Download className="h-3.5 w-3.5" />
              Export ESG Audit CSV
            </Button>
          </div>
        </div>

        {/* Rolling Global Impact Hero Display */}
        <div className="neu-border mt-6 border-emerald-500 bg-emerald-50/70 p-5 dark:border-emerald-700 dark:bg-emerald-950/40">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="font-mono text-xs font-black uppercase text-emerald-900 dark:text-emerald-300">
                Campus-Wide Cumulative CO₂ Prevented
              </span>
              <div className="mt-1 font-mono text-4xl font-black text-emerald-600 dark:text-emerald-400">
                {globalSummary.totalCo2SavedKg.toLocaleString()} kg{" "}
                <span className="text-2xl text-emerald-800 dark:text-emerald-300">
                  ({globalSummary.totalCo2SavedPounds.toLocaleString()} lbs)
                </span>
              </div>
              <p className="mt-1 font-mono text-xs font-bold text-emerald-800 dark:text-emerald-300">
                🌱 Through {globalSummary.totalTripsCompleted} shared carpool journeys &{" "}
                {globalSummary.totalCarsDisplaced} individual vehicles taken off the road.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded border-2 border-black bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
              <Sparkles className="h-5 w-5 text-emerald-500" />
              <div className="font-mono text-xs font-bold">
                <span className="text-zinc-500">Active Ecosystem:</span>
                <p className="text-zinc-900 dark:text-white">
                  {globalSummary.activeClubCount} Clubs Participating
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Real-World Eco-Equivalencies Cards */}
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="neu-border bg-zinc-50 p-3.5 dark:bg-zinc-800/80">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <Trees className="h-4 w-4" />
              <span className="font-mono text-[10px] font-black uppercase">Tree Seedlings</span>
            </div>
            <div className="mt-1 font-mono text-xl font-black text-zinc-900 dark:text-white">
              {globalSummary.equivalents.treeSeedlingsGrownFor10Years}
            </div>
            <span className="font-mono text-[10px] text-zinc-500">
              Grown for 10 years carbon absorption
            </span>
          </div>

          <div className="neu-border bg-zinc-50 p-3.5 dark:bg-zinc-800/80">
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <Fuel className="h-4 w-4" />
              <span className="font-mono text-[10px] font-black uppercase">Gasoline Displaced</span>
            </div>
            <div className="mt-1 font-mono text-xl font-black text-zinc-900 dark:text-white">
              {globalSummary.equivalents.gallonsOfGasolineSaved} gal
            </div>
            <span className="font-mono text-[10px] text-zinc-500">Avoided fuel consumption</span>
          </div>

          <div className="neu-border bg-zinc-50 p-3.5 dark:bg-zinc-800/80">
            <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
              <BatteryCharging className="h-4 w-4" />
              <span className="font-mono text-[10px] font-black uppercase">Phone Charges</span>
            </div>
            <div className="mt-1 font-mono text-xl font-black text-zinc-900 dark:text-white">
              {globalSummary.equivalents.smartphonesCharged.toLocaleString()}
            </div>
            <span className="font-mono text-[10px] text-zinc-500">Full smartphone battery cycles</span>
          </div>

          <div className="neu-border bg-zinc-50 p-3.5 dark:bg-zinc-800/80">
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <Zap className="h-4 w-4" />
              <span className="font-mono text-[10px] font-black uppercase">Coal Avoided</span>
            </div>
            <div className="mt-1 font-mono text-xl font-black text-zinc-900 dark:text-white">
              {globalSummary.equivalents.poundsOfCoalAvoided} lbs
            </div>
            <span className="font-mono text-[10px] text-zinc-500">Unburned fossil grid power</span>
          </div>
        </div>
      </div>

      {/* Main Interactive Stations */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="neu-border grid w-full max-w-md grid-cols-3 bg-white p-1 dark:bg-zinc-900">
          <TabsTrigger
            value="simulator"
            className="font-mono text-xs font-bold uppercase data-[state=active]:bg-black data-[state=active]:text-white dark:data-[state=active]:bg-lime dark:data-[state=active]:text-black"
          >
            Trip Calculator
          </TabsTrigger>
          <TabsTrigger
            value="leaderboard"
            className="font-mono text-xs font-bold uppercase data-[state=active]:bg-black data-[state=active]:text-white dark:data-[state=active]:bg-lime dark:data-[state=active]:text-black"
          >
            Eco Leaderboard
          </TabsTrigger>
          <TabsTrigger
            value="log"
            className="font-mono text-xs font-bold uppercase data-[state=active]:bg-black data-[state=active]:text-white dark:data-[state=active]:bg-lime dark:data-[state=active]:text-black"
          >
            Itemized Audit Log
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Interactive Trip Offset Simulator */}
        <TabsContent value="simulator" className="mt-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Controls (7 cols) */}
            <div className="space-y-6 lg:col-span-7">
              <div className="neu-border bg-white p-6 dark:bg-zinc-900">
                <div className="flex items-center gap-2 mb-4">
                  <Compass className="h-4 w-4 text-black dark:text-lime" />
                  <h3 className="font-mono text-sm font-black uppercase text-zinc-900 dark:text-white">
                    Simulate & Record Carpool Offset
                  </h3>
                </div>

                <form onSubmit={handleLogTrip} className="space-y-4">
                  {/* Origin & Destination Selectors */}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="block font-mono text-[11px] font-bold uppercase text-zinc-600 dark:text-zinc-400 mb-1">
                        Departure Origin
                      </label>
                      <select
                        aria-label="Departure Origin"
                        value={selectedOrigin.label}
                        onChange={(e) => {
                          const found = CAMPUS_GEO_PRESETS.find((p) => p.label === e.target.value);
                          if (found) setSelectedOrigin(found);
                        }}
                        className="neu-border w-full bg-white p-2 font-mono text-xs font-bold text-zinc-800 dark:bg-zinc-800 dark:text-white"
                      >
                        {CAMPUS_GEO_PRESETS.map((p) => (
                          <option key={p.label} value={p.label}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-mono text-[11px] font-bold uppercase text-zinc-600 dark:text-zinc-400 mb-1">
                        Event Destination
                      </label>
                      <select
                        aria-label="Event Destination"
                        value={selectedDest.label}
                        onChange={(e) => {
                          const found = CAMPUS_GEO_PRESETS.find((p) => p.label === e.target.value);
                          if (found) setSelectedDest(found);
                        }}
                        className="neu-border w-full bg-white p-2 font-mono text-xs font-bold text-zinc-800 dark:bg-zinc-800 dark:text-white"
                      >
                        {CAMPUS_GEO_PRESETS.map((p) => (
                          <option key={p.label} value={p.label}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Vehicle Powertrain Type */}
                  <div>
                    <label className="block font-mono text-[11px] font-bold uppercase text-zinc-600 dark:text-zinc-400 mb-1">
                      Vehicle Efficiency Profile
                    </label>
                    <select
                      aria-label="Vehicle Efficiency Profile"
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value as VehicleFuelType)}
                      className="neu-border w-full bg-white p-2 font-mono text-xs font-bold text-zinc-800 dark:bg-zinc-800 dark:text-white"
                    >
                      <option value="gasoline_sedan">Gasoline Sedan (404 g CO2/mi)</option>
                      <option value="gasoline_suv">SUV / Pickup Truck (460 g CO2/mi)</option>
                      <option value="hybrid">Hybrid Vehicle (210 g CO2/mi)</option>
                      <option value="electric_ev">Electric Vehicle EV (110 g CO2/mi)</option>
                      <option value="diesel_van">Passenger Van (430 g CO2/mi)</option>
                    </select>
                  </div>

                  {/* Passenger Headcount Slider */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="font-mono text-xs font-bold uppercase text-zinc-700 dark:text-zinc-300">
                        Passengers Carpooling (Cars Off The Road)
                      </label>
                      <span className="font-mono text-sm font-black text-emerald-600">
                        {riderCount} Riders Displaced
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="6"
                      step="1"
                      value={riderCount}
                      onChange={(e) => setRiderCount(parseInt(e.target.value, 10))}
                      className="w-full cursor-pointer accent-black dark:accent-lime"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isLogging}
                    className="neu-border w-full bg-lime py-2.5 font-mono text-xs font-black uppercase text-black hover:bg-lime/80"
                  >
                    {logSuccess ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-800" /> Offset Verified & Recorded!
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" /> {isLogging ? "Recording..." : "Record Verified Carpool Offset"}
                      </>
                    )}
                  </Button>
                </form>
              </div>
            </div>

            {/* Right Preview Card (5 cols) */}
            <div className="space-y-6 lg:col-span-5">
              <div className="neu-border bg-white p-6 dark:bg-zinc-900">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-4 w-4 text-emerald-500" />
                  <h3 className="font-mono text-sm font-black uppercase text-zinc-900 dark:text-white">
                    Trip Offset Preview
                  </h3>
                </div>

                <div className="rounded border-2 border-black bg-zinc-50 p-4 dark:bg-zinc-800">
                  <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
                    Net Atmospheric Relief
                  </span>
                  <div className="mt-1 font-mono text-3xl font-black text-emerald-600 dark:text-emerald-400">
                    {currentSimulatedOffset.co2SavedKg} kg CO₂
                  </div>
                  <span className="font-mono text-xs font-bold text-zinc-500">
                    ({currentSimulatedOffset.co2SavedPounds} lbs prevented)
                  </span>

                  <div className="mt-4 space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-700 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Haversine Distance:</span>
                      <span className="font-bold text-zinc-900 dark:text-white">{activeDistance} miles</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Vehicle Multiplier:</span>
                      <span className="font-bold text-zinc-900 dark:text-white">{vehicleType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Displaced Vehicles:</span>
                      <span className="font-bold text-emerald-600">{riderCount} cars</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Club Eco-Leaderboard */}
        <TabsContent value="leaderboard" className="mt-4">
          <div className="neu-border overflow-hidden bg-white dark:bg-zinc-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="border-b-2 border-black bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
                  <tr>
                    <th className="p-3 font-black uppercase text-zinc-900 dark:text-white">Rank</th>
                    <th className="p-3 font-black uppercase text-zinc-900 dark:text-white">Club Organization</th>
                    <th className="p-3 font-black uppercase text-zinc-900 dark:text-white">Total Carpools</th>
                    <th className="p-3 font-black uppercase text-zinc-900 dark:text-white">Riders Shared</th>
                    <th className="p-3 font-black uppercase text-zinc-900 dark:text-white">Total CO₂ Saved</th>
                    <th className="p-3 font-black uppercase text-zinc-900 dark:text-white text-center">Ecosystem Badge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {leaderboard.map((entry, idx) => (
                    <tr key={entry.clubId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                      <td className="p-3 font-black text-zinc-900 dark:text-white">#{idx + 1}</td>
                      <td className="p-3 font-bold text-zinc-900 dark:text-white">{entry.clubName}</td>
                      <td className="p-3 font-semibold text-zinc-700 dark:text-zinc-300">{entry.totalTrips} trips</td>
                      <td className="p-3 font-semibold text-blue-600 dark:text-blue-400">{entry.totalRidersShared} students</td>
                      <td className="p-3 font-black text-emerald-600 dark:text-emerald-400">{entry.totalCo2SavedKg} kg</td>
                      <td className="p-3 text-center">
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                          <Trees className="h-3 w-3" /> {entry.sustainabilityTier}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Itemized Audit Log */}
        <TabsContent value="log" className="mt-4">
          <div className="neu-border overflow-hidden bg-white dark:bg-zinc-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="border-b-2 border-black bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
                  <tr>
                    <th className="p-3 font-black uppercase text-zinc-900 dark:text-white">Trip ID</th>
                    <th className="p-3 font-black uppercase text-zinc-900 dark:text-white">Driver</th>
                    <th className="p-3 font-black uppercase text-zinc-900 dark:text-white">Route</th>
                    <th className="p-3 font-black uppercase text-zinc-900 dark:text-white">Distance</th>
                    <th className="p-3 font-black uppercase text-zinc-900 dark:text-white">Riders</th>
                    <th className="p-3 font-black uppercase text-zinc-900 dark:text-white">CO₂ Prevented</th>
                    <th className="p-3 font-black uppercase text-zinc-900 dark:text-white">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {trips.map((trip) => (
                    <tr key={trip.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                      <td className="p-3 font-bold text-zinc-500">{trip.id}</td>
                      <td className="p-3 font-bold text-zinc-900 dark:text-white">{trip.driverName}</td>
                      <td className="p-3 text-zinc-700 dark:text-zinc-300">
                        {trip.origin.label} → {trip.destination.label}
                      </td>
                      <td className="p-3 font-semibold">{trip.distanceMiles} mi</td>
                      <td className="p-3 font-bold text-blue-600">{trip.riderCount}</td>
                      <td className="p-3 font-black text-emerald-600">+{trip.co2SavedKg} kg</td>
                      <td className="p-3 text-zinc-500">{new Date(trip.completedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DynamicRideShareCarbonOffset;
