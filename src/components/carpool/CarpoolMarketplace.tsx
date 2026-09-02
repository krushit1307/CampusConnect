import React, { useState, useMemo, useCallback } from "react";
import {
  Car,
  MapPin,
  Calendar,
  Users,
  SlidersHorizontal,
  Search,
  CheckCircle2,
  X,
  Leaf,
  CreditCard,
} from "lucide-react";
import {
  CarpoolFilters,
  RideCategory,
  fetchRides,
  fetchRideStats,
  getDefaultFilters,
  getCategories,
  formatDateTime,
  formatDuration,
} from "../../services/CarpoolService";
import { BookRideModal } from "./BookRideModal";

// ─── Stat Card ───────────────────────────────────────────────────────
function NavStat({
  icon,
  label,
  val,
}: {
  icon: React.ReactNode;
  label: string;
  val: string | number;
}) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
      <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400">{icon}</div>
      <div>
        <p className="text-xl font-black text-white">{val}</p>
        <p className="text-xs text-white/50 uppercase tracking-wider font-semibold">{label}</p>
      </div>
    </div>
  );
}

// ─── Layout ──────────────────────────────────────────────────────────
export function CarpoolMarketplace() {
  const [filters, setFilters] = useState<CarpoolFilters>(getDefaultFilters());
  const [stats] = useState(fetchRideStats());
  const [rides, setRides] = useState(() => fetchRides(getDefaultFilters()));

  const [selectedRideId, setSelectedRideId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const categories = getCategories();

  // Handle filtering
  useEffect(() => {
    setRides(fetchRides(filters));
  }, [filters]);

  const updateFilter = useCallback((partial: Partial<CarpoolFilters>) => {
    setFilters((f) => ({ ...f, ...partial }));
  }, []);

  const handleBookSuccess = (msg: string) => {
    setSelectedRideId(null);
    setSuccessMsg(msg);
    // Refresh rides to update seat counts
    setRides(fetchRides(filters));
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const selectedRide = useMemo(
    () => rides.find((r) => r.id === selectedRideId),
    [rides, selectedRideId],
  );

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(to bottom right, #0a0a14, #0f172a)" }}
    >
      {/* Hero */}
      <div className="relative pt-12 pb-8 overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 z-0 opacity-20 bg-[url('https://maps.googleapis.com/maps/api/staticmap?center=40.7128,-74.0060&zoom=11&size=1000x400&maptype=roadmap&style=feature:all|element:labels|visibility:off&style=feature:water|element:geometry|color:0x000000&style=feature:road|element:geometry|color:0x38bdf8')] bg-cover bg-center" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/30">
                <Car className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold text-white">Campus Rideshare</h1>
                <p className="text-sky-300 font-medium mt-1">Share the ride, split the cost.</p>
              </div>
            </div>

            <button className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-lg flex items-center gap-2">
              <Car className="w-4 h-4" /> Offer a Ride
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <NavStat icon={<MapPin />} label="Active Rides" val={stats.activeRides} />
            <NavStat icon={<Users />} label="Open Seats" val={stats.seatsAvailable} />
            <NavStat icon={<CreditCard />} label="Avg. Price" val={`$${stats.averagePrice}`} />
            <NavStat icon={<Leaf />} label="CO₂ Saved" val={`${stats.co2SavedKg}kg`} />
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-6">
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-5 h-5" /> {successMsg}
            </div>
            <button onClick={() => setSuccessMsg(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col lg:flex-row gap-6">
        {/* Filters Sidebar */}
        <div className="lg:w-72 flex-shrink-0 space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-white font-bold mb-4">
              <SlidersHorizontal className="w-4 h-4 text-sky-400" /> Filters
            </div>

            {/* Ride Type */}
            <div className="mb-5">
              <label className="text-xs text-white/50 uppercase font-bold block mb-2">
                Category
              </label>
              <select
                value={filters.category}
                onChange={(e) => updateFilter({ category: e.target.value as RideCategory | "All" })}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
              >
                <option value="All">Any Category</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Max Price */}
            <div className="mb-5">
              <label className="text-xs text-white/50 uppercase font-bold block mb-2">
                Max Price: <span className="text-sky-400">${filters.maxPrice}</span>
              </label>
              <input
                type="range"
                min="0"
                max="60"
                step="5"
                value={filters.maxPrice}
                onChange={(e) => updateFilter({ maxPrice: Number(e.target.value) })}
                className="w-full accent-sky-500"
              />
              <div className="flex justify-between text-[10px] text-white/30 mt-1">
                <span>$0</span>
                <span>$60+</span>
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-white/80 font-medium">Hide Full Rides</span>
                <input
                  type="checkbox"
                  checked={filters.hideFull}
                  onChange={(e) => updateFilter({ hideFull: e.target.checked })}
                  className="accent-sky-500 w-4 h-4"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-white/80 font-medium">Verified Drivers Only</span>
                <input
                  type="checkbox"
                  checked={filters.verifiedOnly}
                  onChange={(e) => updateFilter({ verifiedOnly: e.target.checked })}
                  className="accent-sky-500 w-4 h-4"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Search & Sort Bar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="Search destination, driver, or pickup..."
                value={filters.query}
                onChange={(e) => updateFilter({ query: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-sky-500/50"
              />
            </div>
            <select
              value={filters.sortBy}
              onChange={(e) => updateFilter({ sortBy: e.target.value as CarpoolFilters["sortBy"] })}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-medium focus:outline-none focus:border-sky-500/50"
            >
              <option value="date_asc">Earliest Departure</option>
              <option value="date_desc">Latest Departure</option>
              <option value="price_asc">Lowest Price</option>
              <option value="rating">Highest Rated Driver</option>
            </select>
          </div>

          {/* Ride List */}
          <div className="space-y-4">
            {rides.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
                <Car className="w-12 h-12 text-white/20 mx-auto mb-4" />
                <p className="text-white font-bold text-lg mb-1">No rides found</p>
                <p className="text-white/50 text-sm">Try adjusting your filters or search term.</p>
              </div>
            ) : (
              rides.map((ride) => (
                <div
                  key={ride.id}
                  className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-colors flex flex-col md:flex-row gap-6"
                >
                  {/* Timeline/Meta */}
                  <div className="flex-1 min-w-0 relative">
                    <div className="absolute left-[7px] top-8 bottom-6 w-0.5 bg-gradient-to-b from-sky-500 to-rose-500 opacity-30" />

                    <div className="flex items-start gap-3 mb-6 relative z-10">
                      <div className="w-4 h-4 rounded-full border-4 border-slate-900 bg-sky-500 flex-shrink-0 mt-1" />
                      <div>
                        <p className="text-xs font-bold text-sky-400 mb-0.5">
                          {formatDateTime(ride.departureTime)}
                        </p>
                        <p className="text-base text-white font-bold">{ride.departure.name}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 relative z-10">
                      <div className="w-4 h-4 rounded-full border-4 border-slate-900 bg-rose-500 flex-shrink-0 mt-1" />
                      <div>
                        <p className="text-xs font-bold text-rose-400 mb-0.5">
                          ~{formatDuration(ride.estimatedDurationMins)} trip
                        </p>
                        <p className="text-base text-white font-bold">{ride.destination.name}</p>
                      </div>
                    </div>
                  </div>

                  <div className="hidden md:block w-px bg-white/10" />

                  {/* Driver & Action */}
                  <div className="md:w-64 flex flex-col justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={ride.driverAvatar}
                        alt={ride.driverName}
                        className="w-10 h-10 rounded-full bg-slate-800"
                      />
                      <div>
                        <p className="text-sm font-bold text-white flex items-center gap-1">
                          {ride.driverName}{" "}
                          {ride.verifiedDriver && (
                            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                          )}
                        </p>
                        <p className="text-xs text-white/50">
                          ★ {ride.driverRating} · {ride.totalTrips} trips
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-auto">
                      <div>
                        <p className="text-xl font-black text-white">${ride.pricePerSeat}</p>
                        <p className="text-[10px] text-white/40 uppercase font-bold tracking-wide">
                          Per Seat
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-white flex items-center justify-end gap-1">
                          <Users className="w-3.5 h-3.5 text-white/50" />{" "}
                          {ride.totalSeats - ride.bookedSeats} left
                        </p>
                        <p className="text-[10px] text-white/40 font-bold uppercase">
                          {ride.category}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedRideId(ride.id)}
                      className="w-full bg-sky-500 hover:bg-sky-400 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-sky-500/20"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {selectedRide && (
        <BookRideModal
          ride={selectedRide}
          onClose={() => setSelectedRideId(null)}
          onSuccess={handleBookSuccess}
        />
      )}
    </div>
  );
}
