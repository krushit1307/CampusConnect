import React, { useEffect, useState, useMemo } from "react";
import {
  Bus,
  Train,
  Navigation,
  Compass,
  AlertTriangle,
  Battery,
  MapPin,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sliders,
  CheckCircle,
} from "lucide-react";
import {
  transitScooterService,
  getTransitItineraries,
  CAMPUS_TRANSIT_HUBS,
} from "../../services/transitScooterService";
import { EScooter, TransitItinerary, TransitStop } from "../../types/transitScooter";
import { cn } from "../../lib/utils";
import { toast } from "sonner";

interface EventTransitSyncWidgetProps {
  venueLatitude: number;
  venueLongitude: number;
  venueName?: string;
  className?: string;
}

export const EventTransitSyncWidget: React.FC<EventTransitSyncWidgetProps> = ({
  venueLatitude,
  venueLongitude,
  venueName = "Main Venue",
  className,
}) => {
  // Config states
  const [selectedHubId, setSelectedHubId] = useState<string>(CAMPUS_TRANSIT_HUBS[0].id);
  const [radiusFeet, setRadiusFeet] = useState<number>(200);
  const [minBattery, setMinBattery] = useState<number>(20);
  const [showConfig, setShowConfig] = useState<boolean>(false);

  // Loaded states
  const [itineraries, setItineraries] = useState<TransitItinerary[]>([]);
  const [selectedItineraryId, setSelectedItineraryId] = useState<string | null>(null);
  const [scooters, setScooters] = useState<EScooter[]>([]);
  const [loadingScooters, setLoadingScooters] = useState<boolean>(false);
  const [scooterError, setScooterError] = useState<string | null>(null);
  const [reservedScooterId, setReservedScooterId] = useState<string | null>(null);

  // Sorting & Filtering states
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"distance" | "battery" | "cost">("distance");

  // Computed filtered and sorted scooters list
  const filteredAndSortedScooters = useMemo(() => {
    let result = [...scooters];
    if (providerFilter !== "all") {
      result = result.filter((s) => s.provider === providerFilter);
    }
    result.sort((a, b) => {
      if (sortBy === "battery") {
        return b.batteryPercent - a.batteryPercent;
      }
      if (sortBy === "cost") {
        const aCost = a.unlockPrice + a.pricePerMinute * 10; // estimate 10 min ride cost
        const bCost = b.unlockPrice + b.pricePerMinute * 10;
        return aCost - bCost;
      }
      return a.distanceToStopFeet - b.distanceToStopFeet; // default distance
    });
    return result;
  }, [scooters, providerFilter, sortBy]);

  // Generate transit routes reactively when coordinates change
  useEffect(() => {
    if (!venueLatitude || !venueLongitude) return;
    const routes = getTransitItineraries(venueLatitude, venueLongitude, venueName);
    setItineraries(routes);
    if (routes.length > 0) {
      setSelectedItineraryId(routes[0].id);
    }
  }, [venueLatitude, venueLongitude, venueName]);

  // Find active itinerary
  const activeItinerary = useMemo(() => {
    return itineraries.find((i) => i.id === selectedItineraryId) || null;
  }, [itineraries, selectedItineraryId]);

  // Load nearby e-scooters for the final transit stop in the route
  const fetchScooters = async (stop: TransitStop) => {
    setLoadingScooters(true);
    setScooterError(null);
    try {
      const data = await transitScooterService.getAvailableScooters(
        stop.latitude,
        stop.longitude,
        radiusFeet,
        minBattery,
      );
      setScooters(data);
    } catch (err: any) {
      setScooterError(err.message || "Failed to sync micro-mobility e-scooters.");
      toast.error("Scooter sync failed. Returning client cache.");
    } finally {
      setLoadingScooters(false);
    }
  };

  useEffect(() => {
    if (!activeItinerary) return;
    fetchScooters(activeItinerary.finalStop);
  }, [activeItinerary, radiusFeet, minBattery]);

  // Handle reserve action
  const handleReserve = async (scooter: EScooter) => {
    try {
      setReservedScooterId(scooter.id);
      const success = await transitScooterService.reserveScooter(scooter.id, scooter.provider);
      if (success) {
        toast.success(`Reserved ${scooter.provider} scooter ${scooter.id}!`);
        // Open deep link app
        window.open(scooter.deepLink, "_blank");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to reserve e-scooter.");
      setReservedScooterId(null);
    }
  };

  const getBatteryColor = (percent: number) => {
    if (percent >= 60) return "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20";
    if (percent >= 30) return "text-amber-500 bg-amber-50 dark:bg-amber-950/20";
    return "text-rose-500 bg-rose-50 dark:bg-rose-950/20";
  };

  const getProviderColor = (provider: string) => {
    if (provider === "lime") return "bg-lime text-black border-lime";
    if (provider === "bird") return "bg-sky-500 text-white border-sky-500";
    return "bg-amber-500 text-black border-amber-500";
  };

  return (
    <div
      className={cn(
        "neu-border p-6 bg-white dark:bg-zinc-900 font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]",
        className,
      )}
    >
      {/* Widget Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b-2 border-black dark:border-zinc-700 pb-4 mb-4">
        <div>
          <h3 className="text-base font-bold uppercase flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
            <Bus className="h-5 w-5 text-indigo-600" />
            Transit Sync & Last-Mile Mobility
          </h3>
          <p className="text-[11px] text-zinc-500 mt-1">
            Calculate public bus travel to final stops and book nearby e-scooters for the final
            stretch.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="p-1.5 border-2 border-black dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors"
            title="Configure Range and Battery Settings"
          >
            <Sliders className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
          </button>
          <button
            onClick={() => activeItinerary && fetchScooters(activeItinerary.finalStop)}
            className="p-1.5 border-2 border-black dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors"
            title="Refresh E-Scooters list"
          >
            <RefreshCw className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
          </button>
        </div>
      </div>

      {/* Configurations panel */}
      {showConfig && (
        <div className="border-2 border-black dark:border-zinc-700 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg mb-4 space-y-3.5 text-xs">
          <div className="space-y-1">
            <div className="flex justify-between font-bold text-zinc-700 dark:text-zinc-300">
              <span>Max Scooter Radius:</span>
              <span>{radiusFeet} feet</span>
            </div>
            <input
              type="range"
              min={50}
              max={500}
              step={50}
              value={radiusFeet}
              onChange={(e) => setRadiusFeet(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between font-bold text-zinc-700 dark:text-zinc-300">
              <span>Min Scooter Battery:</span>
              <span>{minBattery}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={80}
              step={5}
              value={minBattery}
              onChange={(e) => setMinBattery(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Hub Select and Itinerary Lists */}
      <div className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-zinc-500 uppercase">
            Start Commute Hub:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {CAMPUS_TRANSIT_HUBS.map((hub) => (
              <button
                key={hub.id}
                onClick={() => {
                  setSelectedHubId(hub.id);
                  // Find index to sync active itinerary
                  const hubIdx = CAMPUS_TRANSIT_HUBS.findIndex((h) => h.id === hub.id);
                  if (itineraries[hubIdx]) {
                    setSelectedItineraryId(itineraries[hubIdx].id);
                  }
                }}
                className={cn(
                  "p-2 border-2 border-black text-left text-xs font-bold transition-all truncate",
                  selectedHubId === hub.id
                    ? "bg-indigo-100 text-indigo-950 shadow-[2px_2px_0px_0px_rgba(79,70,229,1)]"
                    : "bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100",
                )}
              >
                <Compass className="h-3.5 w-3.5 mb-1 text-indigo-600" />
                {hub.name.split(" Hub")[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Itinerary Route Summary */}
        {activeItinerary && (
          <div className="border-2 border-black dark:border-zinc-700 p-4 rounded-xl space-y-4 bg-zinc-50/50 dark:bg-zinc-800/20">
            {/* Itinerary Leg walk distance indicator */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {activeItinerary.legs[0].mode === "train" ? (
                  <Train className="h-5 w-5 text-indigo-600" />
                ) : (
                  <Bus className="h-5 w-5 text-indigo-600" />
                )}
                <div>
                  <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                    {activeItinerary.name}
                  </h4>
                  <p className="text-[10px] text-zinc-500">
                    Est. Transit Time: {activeItinerary.totalMinutes} mins
                  </p>
                </div>
              </div>

              {activeItinerary.walkingDistanceMiles > 0.5 ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300 text-[10px] font-bold rounded">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Long Walk: {activeItinerary.walkingDistanceMiles} mi</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300 text-[10px] font-bold rounded">
                  <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>Short Walk: {activeItinerary.walkingDistanceMiles} mi</span>
                </div>
              )}
            </div>

            {/* Travel Path timeline */}
            <div className="space-y-3 border-l-2 border-black dark:border-zinc-700 pl-4 ml-2.5 relative">
              {activeItinerary.legs.map((leg, idx) => (
                <div key={leg.id} className="relative text-xs">
                  {/* Timeline dot */}
                  <span className="absolute -left-[23px] top-0.5 w-2 h-2 rounded-full border border-black bg-white dark:bg-zinc-800 ring-4 ring-zinc-50 dark:ring-zinc-900" />

                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">
                        {leg.mode === "walk" ? "🚶 Walk" : `🚌 Board ${leg.routeName}`}
                      </span>
                      <p className="text-[10px] text-zinc-500">
                        {leg.originName} $\rightarrow$ {leg.destinationName}
                      </p>
                    </div>
                    <span className="font-bold text-zinc-700 dark:text-zinc-300 shrink-0 text-right">
                      {leg.estimatedMinutes} mins ({leg.distanceMiles} mi)
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Micro-mobility search header */}
            {activeItinerary.walkingDistanceMiles > 0.5 && (
              <div className="border-t-2 border-dashed border-zinc-200 dark:border-zinc-700 pt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase text-zinc-500">
                    🛴 Available last-mile E-scooters
                  </span>
                  <span className="text-[10px] text-zinc-400 font-bold uppercase">
                    Radius: {radiusFeet} ft
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 bg-zinc-100/80 dark:bg-zinc-800 p-2.5 rounded-lg text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500 font-bold uppercase">Filter:</span>
                    <select
                      value={providerFilter}
                      onChange={(e) => setProviderFilter(e.target.value)}
                      className="border-2 border-black bg-white dark:bg-zinc-900 px-1.5 py-0.5 font-bold outline-none"
                    >
                      <option value="all">All Providers</option>
                      <option value="lime">Lime Only</option>
                      <option value="bird">Bird Only</option>
                      <option value="spin">Spin Only</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500 font-bold uppercase">Sort:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="border-2 border-black bg-white dark:bg-zinc-900 px-1.5 py-0.5 font-bold outline-none"
                    >
                      <option value="distance">Distance (Closest)</option>
                      <option value="battery">Battery (Highest)</option>
                      <option value="cost">Estimated Cost</option>
                    </select>
                  </div>
                </div>

                {loadingScooters ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-xs text-zinc-500">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                    Finding available e-scooters...
                  </div>
                ) : scooterError ? (
                  <div className="border-2 border-rose-200 bg-rose-50 dark:bg-rose-950/20 text-rose-950 dark:text-rose-300 p-3 rounded-lg text-[11px] leading-relaxed">
                    {scooterError}
                  </div>
                ) : filteredAndSortedScooters.length === 0 ? (
                  <div className="py-6 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg text-center text-xs text-zinc-500 bg-white dark:bg-zinc-800">
                    No matching e-scooters found within {radiusFeet} feet of the stop.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {filteredAndSortedScooters.map((s) => {
                      const isReserved = reservedScooterId === s.id;
                      return (
                        <div
                          key={s.id}
                          className="border-2 border-black dark:border-zinc-700 p-3 rounded-lg bg-white dark:bg-zinc-800 flex justify-between items-start gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all"
                        >
                          <div className="space-y-1.5 text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "px-1.5 py-0.5 border border-black rounded text-[9px] font-black uppercase shrink-0",
                                  getProviderColor(s.provider),
                                )}
                              >
                                {s.provider}
                              </span>
                              <span className="font-bold text-zinc-700 dark:text-zinc-300">
                                {s.distanceToStopFeet} ft away
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 px-1 rounded text-[10px] font-bold",
                                  getBatteryColor(s.batteryPercent),
                                )}
                              >
                                <Battery className="h-3.5 w-3.5" />
                                {s.batteryPercent}%
                              </span>
                              <span className="text-zinc-500 font-bold">
                                ${s.unlockPrice.toFixed(2)} + ${s.pricePerMinute.toFixed(2)}/min
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleReserve(s)}
                            disabled={isReserved}
                            className={cn(
                              "px-2.5 py-1.5 border border-black rounded text-[10px] font-bold uppercase transition-all shrink-0 shadow-[1px_1px_0px_rgba(0,0,0,1)]",
                              isReserved
                                ? "bg-emerald-100 text-emerald-950 border-emerald-600 cursor-not-allowed shadow-none"
                                : "bg-black text-white hover:bg-zinc-800 active:scale-95",
                            )}
                          >
                            {isReserved ? "Reserved" : "Reserve"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
