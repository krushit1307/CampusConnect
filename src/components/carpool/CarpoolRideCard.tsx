import React from 'react';
import { Car, Navigation, MapPin, Clock, UserPlus, ShieldCheck } from 'lucide-react';

export interface CarpoolRide {
  id: string;
  originLocation: string;
  destinationLocation: string;
  departureTime: string;
  driverName: string;
  driverAvatar: string;
  seatsAvailable: number;
  totalSeats: number;
  pricePerSeatUSD: number;
  carModel: string;
  tags: string[];
  description: string;
  isBooked: boolean;
  rideType: 'Daily Commute' | 'Weekend Trip' | 'Grocery Run';
}

interface CarpoolRideCardProps {
  ride: CarpoolRide;
  onBook: () => void;
  onInspect: () => void;
}

export default function CarpoolRideCard({ ride, onBook, onInspect }: CarpoolRideCardProps) {
  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:shadow-cyan-500/10 flex flex-col justify-between group">
      <div>
        {/* Header Category & Price */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs px-2.5 py-0.5 rounded-md font-semibold">
              {ride.rideType}
            </span>
            <span className="bg-slate-800 text-slate-300 text-[11px] px-2 py-0.5 rounded-md">
              {ride.carModel}
            </span>
          </div>

          <div className="flex items-baseline gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 font-mono">
            <span className="text-emerald-400 font-black text-sm">${ride.pricePerSeatUSD}</span>
            <span className="text-slate-500 text-[10px]">/ seat</span>
          </div>
        </div>

        {/* Origin to Destination Route */}
        <h3
          onClick={onInspect}
          className="text-base font-bold text-slate-100 group-hover:text-cyan-300 transition cursor-pointer line-clamp-1 mb-3"
        >
          {ride.originLocation} ➔ {ride.destinationLocation}
        </h3>

        {/* Schedule & Pickup Info */}
        <div className="space-y-1.5 mb-4 bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="truncate">{ride.departureTime}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1 border-t border-slate-900">
            <span>Available Seats: <strong className="text-slate-200">{ride.seatsAvailable}</strong> / {ride.totalSeats}</span>
            <span className="text-emerald-400 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Student Verified</span>
          </div>
        </div>

        <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed mb-4">
          {ride.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {ride.tags.map((tag, i) => (
            <span key={i} className="bg-slate-950 text-slate-400 border border-slate-800 text-[11px] px-2 py-0.5 rounded-md">
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Footer Driver Info */}
      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src={ride.driverAvatar} alt={ride.driverName} className="w-7 h-7 rounded-full border border-slate-700" />
          <div className="text-xs font-semibold text-slate-300">{ride.driverName}</div>
        </div>

        <button
          onClick={onBook}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-md ${
            ride.isBooked
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/20'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5" />
          {ride.isBooked ? 'Seat Reserved' : 'Book Seat'}
        </button>
      </div>
    </div>
  );
}
