import React from 'react';
import { PackageCheck, CheckCircle2, ShieldCheck, Gift, Clock } from 'lucide-react';

interface ReunitedActivity {
  id: string;
  itemTitle: string;
  location: string;
  recoveredByStudent: string;
  returnedToOwner: string;
  rewardUSD: number;
  completedAgo: string;
}

const RECENT_REUNITED_ACTIVITY: ReunitedActivity[] = [
  {
    id: 'act-101',
    itemTitle: 'Apple AirPods Pro Gen 2',
    location: 'Engineering Library Desk',
    recoveredByStudent: 'Elena Rostova',
    returnedToOwner: 'Alex Miller',
    rewardUSD: 40,
    completedAgo: '15 mins ago',
  },
  {
    id: 'act-102',
    itemTitle: 'TI-84 Plus CE Graphing Calculator',
    location: 'Math Building Room 302',
    recoveredByStudent: 'David Chen',
    returnedToOwner: 'Sarah Jenkins',
    rewardUSD: 0,
    completedAgo: '4 hours ago',
  },
  {
    id: 'act-103',
    itemTitle: 'Leather Student ID & Key Lanyard',
    location: 'Campus Gym Reception',
    recoveredByStudent: 'Marcus Vance',
    returnedToOwner: 'Liam O\'Connor',
    rewardUSD: 15,
    completedAgo: '1 day ago',
  },
];

export default function LostFoundActivityTimeline() {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-md">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">528</div>
            <div className="text-slate-400 text-xs font-medium">Reunited Campus Belongings</div>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">98%</div>
            <div className="text-slate-400 text-xs font-medium">Peer Recovery Success Rate</div>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">$4.2k</div>
            <div className="text-slate-400 text-xs font-medium">Peer Rewards Distributed</div>
          </div>
        </div>
      </div>

      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <Clock className="w-5 h-5 text-amber-400" /> Live Campus Item Recovery Stream
      </h3>

      <div className="space-y-4">
        {RECENT_REUNITED_ACTIVITY.map((item) => (
          <div
            key={item.id}
            className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-5 hover:border-amber-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-amber-500/10 text-amber-400 text-[11px] font-mono px-2 py-0.5 rounded border border-amber-500/20 font-bold">
                  {item.location}
                </span>
                <span className="text-slate-500 text-xs font-mono">{item.completedAgo}</span>
              </div>
              <h4 className="text-base font-bold text-slate-100">{item.itemTitle}</h4>
              <div className="text-xs text-slate-400 mt-1 font-mono">
                Recovered by <span className="text-slate-200">{item.recoveredByStudent}</span> ➔ Returned to <span className="text-slate-200">{item.returnedToOwner}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {item.rewardUSD > 0 && (
                <div className="text-amber-400 font-mono font-extrabold text-sm bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20">
                  ${item.rewardUSD} Reward
                </div>
              )}
              <div className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Reunited
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
