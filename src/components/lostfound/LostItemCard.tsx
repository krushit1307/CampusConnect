import React from 'react';
import { MapPin, Calendar, CheckCircle2, ShieldCheck, UserCheck, Gift } from 'lucide-react';

export interface LostFoundItem {
  id: string;
  itemTitle: string;
  itemCategory: string;
  reportType: 'LOST' | 'FOUND';
  location: string;
  dateReported: string;
  rewardAmountUSD: number;
  finderName: string;
  finderAvatar: string;
  verificationStatus: string;
  description: string;
  isClaimed: boolean;
  status: 'ACTIVE_SEARCH' | 'REUNITED';
}

interface LostItemCardProps {
  item: LostFoundItem;
  onClaim: () => void;
  onInspect: () => void;
}

export default function LostItemCard({ item, onClaim, onInspect }: LostItemCardProps) {
  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:shadow-amber-500/10 flex flex-col justify-between group">
      <div>
        {/* Type Pill & Reward */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2.5 py-0.5 rounded-md font-mono font-extrabold border ${
                item.reportType === 'LOST'
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              }`}
            >
              {item.reportType}
            </span>
            <span className="bg-slate-800 text-slate-300 text-[11px] px-2 py-0.5 rounded-md font-medium">
              {item.itemCategory}
            </span>
          </div>

          {item.rewardAmountUSD > 0 && (
            <div className="flex items-center gap-1 bg-amber-500/10 text-amber-400 px-2.5 py-0.5 rounded-md border border-amber-500/20 text-xs font-mono font-bold">
              <Gift className="w-3.5 h-3.5" /> ${item.rewardAmountUSD} Reward
            </div>
          )}
        </div>

        {/* Item Title */}
        <h3
          onClick={onInspect}
          className="text-base font-bold text-slate-100 group-hover:text-amber-300 transition cursor-pointer line-clamp-2 mb-2"
        >
          {item.itemTitle}
        </h3>

        {/* Location & Date Box */}
        <div className="space-y-1.5 mb-4 bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-300">
            <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">{item.location}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="truncate">{item.dateReported}</span>
          </div>
        </div>

        <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed mb-4">
          {item.description}
        </p>
      </div>

      {/* Footer Reporter Info */}
      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src={item.finderAvatar} alt={item.finderName} className="w-7 h-7 rounded-full border border-slate-700" />
          <div className="text-xs font-semibold text-slate-300">{item.finderName}</div>
        </div>

        <button
          onClick={onClaim}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-md ${
            item.isClaimed
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          {item.isClaimed ? 'Reunited' : 'Claim Item'}
        </button>
      </div>
    </div>
  );
}
