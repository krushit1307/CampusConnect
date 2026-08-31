import React, { useState } from 'react';
import { CarpoolRide } from '@/types/carpool';
import { X, MapPin, DollarSign, Clock, Users, ShieldCheck, Check } from 'lucide-react';

interface RideRequestModalProps {
  ride: CarpoolRide;
  isOpen: boolean;
  onClose: () => void;
  onRequestSeat: (rideId: string, pickup: string, dropoff: string) => void;
}

export function RideRequestModal({
  ride,
  isOpen,
  onClose,
  onRequestSeat,
}: RideRequestModalProps) {
  const [pickup, setPickup] = useState(ride.origin);
  const [dropoff, setDropoff] = useState(ride.destination);
  const [isDone, setIsDone] = useState(false);

  if (!isOpen) return null;

  const estimatedFare = 3.5;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRequestSeat(ride.id, pickup, dropoff);
    setIsDone(true);
    setTimeout(() => {
      setIsDone(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white border-4 border-black rounded-lg max-w-md w-full p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 border-2 border-black rounded hover:bg-gray-100"
        >
          <X size={18} />
        </button>

        <h2 className="text-xl font-display font-black text-black mb-1">
          Request Seat in Carpool
        </h2>
        <p className="text-xs font-mono text-gray-600 mb-4">
          Driver: {ride.driverName} • {ride.vehicleModel}
        </p>

        {isDone ? (
          <div className="p-6 text-center space-y-2">
            <div className="w-12 h-12 bg-emerald-100 border-2 border-emerald-600 rounded-full flex items-center justify-center mx-auto text-emerald-700">
              <Check size={24} />
            </div>
            <h3 className="font-display font-black text-lg text-black">Seat Reserved!</h3>
            <p className="font-mono text-xs text-gray-600">
              Driver has been notified. Live telemetry tracking is active.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
            <div>
              <label className="block font-bold uppercase text-gray-700 mb-1">Pickup Stop</label>
              <select
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
                className="w-full p-2.5 border-2 border-black rounded bg-white font-bold"
              >
                {ride.routeStops.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold uppercase text-gray-700 mb-1">Drop-off Destination</label>
              <select
                value={dropoff}
                onChange={(e) => setDropoff(e.target.value)}
                className="w-full p-2.5 border-2 border-black rounded bg-white font-bold"
              >
                {ride.routeStops.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-slate-50 border-2 border-black rounded flex items-center justify-between">
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-bold">Proportional Cost Split</span>
                <div className="font-display font-black text-xl text-black">
                  ${estimatedFare.toFixed(2)}
                </div>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-bold bg-emerald-100 px-2 py-1 rounded border border-emerald-300">
                <ShieldCheck size={14} /> Gas Share Only
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 border-2 border-black rounded font-mono text-xs font-bold uppercase hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-lime hover:bg-lime/90 border-2 border-black rounded font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                Confirm Pickup
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
