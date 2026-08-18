import React from 'react';
import { Car, CheckCircle2, ShieldCheck, DollarSign, Clock } from 'lucide-react';

interface CarpoolActivity {
  id: string;
  route: string;
  driverName: string;
  passengerName: string;
  pricePerSeatUSD: number;
  completedAgo: string;
}

const RECENT_CARPOOL_ACTIVITY: CarpoolActivity[] = [
  {
    id: 'act-1',
    route: 'North Campus Housing ➔ JFK Airport',
    driverName: 'Marcus Vance',
    passengerName: 'Elena Rostova',
    pricePerSeatUSD: 18,
    completedAgo: '30 mins ago',
  },
  {
    id: 'act-2',
    route: 'Downtown Heights ➔ Science Quad',
    driverName: 'Elena Rostova',
    passengerName: 'David Chen',
    pricePerSeatUSD: 5,
    completedAgo: '3 hours ago',
  },
  {
    id: 'act-3',
    route: 'West Campus ➔ Target Commercial Center',
    driverName: 'David Chen',
    passengerName: 'Sophia Lin',
    pricePerSeatUSD: 4,
    completedAgo: '6 hours ago',
  },
];

export default function CarpoolActivityTimeline() {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-md">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">412</div>
            <div className="text-slate-400 text-xs font-medium">Shared Campus Trips</div>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">100%</div>
            <div className="text-slate-400 text-xs font-medium">Student Verified Drivers</div>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">$12.50</div>
            <div className="text-slate-400 text-xs font-medium">Avg Passenger Savings</div>
          </div>
        </div>
      </div>

      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <Clock className="w-5 h-5 text-cyan-400" /> Recent Completed Peer Carpools
      </h3>

      <div className="space-y-4">
        {RECENT_CARPOOL_ACTIVITY.map((item) => (
          <div
            key={item.id}
            className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-5 hover:border-cyan-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-cyan-500/10 text-cyan-400 text-[11px] font-mono px-2 py-0.5 rounded border border-cyan-500/20 font-bold">
                  {item.route}
                </span>
                <span className="text-slate-500 text-xs font-mono">{item.completedAgo}</span>
              </div>
              <h4 className="text-base font-bold text-slate-100">Driver: {item.driverName}</h4>
              <div className="text-xs text-slate-400 mt-1 font-mono">
                Passenger: <span className="text-slate-200">{item.passengerName}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-emerald-400 font-mono font-extrabold text-lg bg-emerald-500/10 px-3.5 py-1.5 rounded-xl border border-emerald-500/20">
                ${item.pricePerSeatUSD}/seat
              </div>
              <div className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Trip Completed
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
