import React, { useState } from "react";
import {
  X,
  MapPin,
  Calendar,
  Clock,
  Car,
  Users,
  Music,
  Briefcase,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  CarpoolRide,
  bookRide,
  formatDateTime,
  formatDuration,
} from "../../services/CarpoolService";

interface BookRideModalProps {
  ride: CarpoolRide;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export function BookRideModal({ ride, onClose, onSuccess }: BookRideModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableSeats = ride.totalSeats - ride.bookedSeats;

  const handleBook = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await bookRide(ride.id);
      onSuccess(res.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to book ride");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-3xl shadow-2xl"
        style={{
          background: "linear-gradient(145deg, #1e1b4b 0%, #0f172a 100%)",
          border: "1px solid rgba(56,189,248,0.25)",
        }}
      >
        {/* Header Map Graphic Simulation */}
        <div className="h-32 bg-slate-800 relative overflow-hidden flex items-center justify-center">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "url('https://maps.googleapis.com/maps/api/staticmap?center=40.7128,-74.0060&zoom=13&size=600x300&maptype=roadmap&style=feature:all|element:labels|visibility:off&style=feature:water|element:geometry|color:0x1e1b4b')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />

          <div className="flex items-center gap-4 z-10 w-full px-8 relative">
            <div className="flex flex-col items-center">
              <div className="w-4 h-4 rounded-full border-4 border-white bg-sky-500 shadow-lg" />
            </div>
            <div className="flex-1 h-1 bg-white/30 border-t border-dashed border-white" />
            <div className="px-3 py-1 rounded-full bg-white text-slate-900 text-xs font-bold shadow-lg">
              {formatDuration(ride.estimatedDurationMins)}
            </div>
            <div className="flex-1 h-1 bg-white/30 border-t border-dashed border-white" />
            <div className="flex flex-col items-center">
              <MapPin className="w-6 h-6 text-rose-500 fill-rose-500 shadow-lg" />
            </div>
          </div>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors z-20"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white leading-tight">
              Ride to {ride.destination.name}
            </h2>
            <div className="text-right flex-shrink-0">
              <span className="text-2xl font-black text-sky-400">${ride.pricePerSeat}</span>
              <span className="text-xs text-white/50 block">/ seat</span>
            </div>
          </div>

          {/* Driver Info */}
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 mb-6">
            <img
              src={ride.driverAvatar}
              alt={ride.driverName}
              className="w-12 h-12 rounded-full ring-2 ring-sky-500/50"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-white font-bold">{ride.driverName}</span>
                {ride.verifiedDriver && <ShieldCheck className="w-4 h-4 text-sky-400" />}
              </div>
              <p className="text-xs text-white/60">
                ★ {ride.driverRating} · {ride.totalTrips} trips
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1.5 text-white bg-white/10 px-2.5 py-1 rounded-lg text-xs font-semibold">
                <Car className="w-4 h-4 text-sky-300" />
                {ride.carModel}
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">
                Departure
              </p>
              <p className="text-sm text-white font-medium flex gap-1.5">
                <Calendar className="w-4 h-4 text-sky-400 shrink-0" />{" "}
                {formatDateTime(ride.departureTime)}
              </p>
              <p className="text-xs text-white/60 ml-5.5 mt-0.5">{ride.departure.name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">
                Arrival
              </p>
              <p className="text-sm text-white font-medium flex gap-1.5">
                <Clock className="w-4 h-4 text-rose-400 shrink-0" /> ~
                {formatDuration(ride.estimatedDurationMins)} trip
              </p>
              <p className="text-xs text-white/60 ml-5.5 mt-0.5">{ride.destination.name}</p>
            </div>
          </div>

          {/* Rules & Prefs */}
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/80 font-medium">
              <Briefcase className="w-3.5 h-3.5 text-white/50" />
              Luggage: {ride.allowedLuggage}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/80 font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
              <Music className="w-3.5 h-3.5 text-white/50 shrink-0" />
              {ride.musicPreference}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/80 font-medium">
              <Users className="w-3.5 h-3.5 text-white/50" />
              {availableSeats} {availableSeats > 1 ? "seats" : "seat"} left
            </span>
          </div>

          {ride.notes && (
            <div className="p-3 rounded-xl bg-sky-900/20 border border-sky-500/20 mb-6">
              <p className="text-sm text-sky-200/90 italic">"{ride.notes}"</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Action */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={onClose}
              className="px-5 py-3 rounded-xl border border-white/20 text-white/80 hover:bg-white/10 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleBook}
              disabled={loading || availableSeats === 0}
              className="flex-1 bg-sky-500 hover:bg-sky-400 text-white py-3 px-6 rounded-xl font-bold transition-all shadow-lg shadow-sky-500/30 flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Request to Join Ride"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
