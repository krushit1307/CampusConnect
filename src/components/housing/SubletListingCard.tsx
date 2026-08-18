import React from 'react';
import { Home, Calendar, MapPin, DollarSign, Bookmark, CheckCircle2, UserCheck } from 'lucide-react';

export interface SubletListing {
  id: string;
  propertyTitle: string;
  location: string;
  leaseTerm: string;
  monthlyRentUSD: number;
  depositUSD: number;
  roomType: 'Private Studio' | 'Private Room (Shared Bath)' | 'Entire Apartment';
  bedrooms: number;
  bathrooms: number;
  isUtilitiesIncluded: boolean;
  isFurnished: boolean;
  posterName: string;
  posterAvatar: string;
  verificationStatus: string;
  description: string;
  isBookmarked: boolean;
  status: 'AVAILABLE' | 'PENDING_LEASE' | 'LEASED';
}

interface SubletListingCardProps {
  sublet: SubletListing;
  onBookmark: () => void;
  onInspect: () => void;
}

export default function SubletListingCard({ sublet, onBookmark, onInspect }: SubletListingCardProps) {
  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:shadow-emerald-500/10 flex flex-col justify-between group">
      <div>
        {/* Header Tags & Bookmark */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-0.5 rounded-md font-semibold">
              {sublet.roomType}
            </span>
            <span className="bg-slate-800 text-slate-300 text-[11px] px-2 py-0.5 rounded-md">
              {sublet.isFurnished ? 'Furnished' : 'Unfurnished'}
            </span>
          </div>

          <button
            onClick={onBookmark}
            className={`p-1.5 rounded-lg border transition ${
              sublet.isBookmarked
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <Bookmark className="w-4 h-4 fill-current" />
          </button>
        </div>

        {/* Rent & Title */}
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-2xl font-black text-white font-mono">${sublet.monthlyRentUSD}</span>
          <span className="text-slate-400 text-xs font-mono">/ month</span>
        </div>

        <h3
          onClick={onInspect}
          className="text-base font-bold text-slate-100 group-hover:text-emerald-300 transition cursor-pointer line-clamp-2 mb-2"
        >
          {sublet.propertyTitle}
        </h3>

        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
          <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span className="truncate">{sublet.location}</span>
        </div>

        <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed mb-4">
          {sublet.description}
        </p>

        {/* Lease Term & Deposit */}
        <div className="space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-xs mb-4 font-mono">
          <div className="flex items-center gap-2 text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">{sublet.leaseTerm}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1 border-t border-slate-900">
            <span>Deposit: ${sublet.depositUSD}</span>
            <span>{sublet.isUtilitiesIncluded ? 'Utilities Included' : 'Utils Extra'}</span>
          </div>
        </div>
      </div>

      {/* Footer Poster Info */}
      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src={sublet.posterAvatar} alt={sublet.posterName} className="w-7 h-7 rounded-full border border-slate-700" />
          <div>
            <div className="text-xs font-semibold text-slate-300 flex items-center gap-1">
              {sublet.posterName} <UserCheck className="w-3 h-3 text-emerald-400" />
            </div>
            <div className="text-[10px] text-slate-500">{sublet.verificationStatus}</div>
          </div>
        </div>

        <button
          onClick={onInspect}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-md transition"
        >
          Contact Student
        </button>
      </div>
    </div>
  );
}
