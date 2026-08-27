import React from 'react';
import { Heart, MapPin, Tag, ShieldCheck, CheckCircle, MessageCircle } from 'lucide-react';

export interface MarketplaceListing {
  id: string;
  title: string;
  sellerName: string;
  sellerAvatar: string;
  sellerRole: string;
  category: string;
  condition: 'Brand New' | 'Like New' | 'Very Good' | 'Good' | 'Fair';
  price: number;
  originalPrice?: number;
  location: string;
  postedDate: string;
  images: string[];
  tags: string[];
  description: string;
  isSaved: boolean;
  isVerifiedStudent: boolean;
}

interface ListingCardProps {
  listing: MarketplaceListing;
  onSave: () => void;
  onInspect: () => void;
}

export default function ListingCard({ listing, onSave, onInspect }: ListingCardProps) {
  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 rounded-2xl overflow-hidden shadow-xl transition-all duration-300 hover:shadow-amber-500/10 flex flex-col justify-between group">
      <div>
        {/* Top Image & Badge Header */}
        <div className="h-44 relative bg-slate-950 overflow-hidden">
          <img
            src={listing.images[0]}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent" />

          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span className="bg-amber-600/90 text-white text-xs px-2.5 py-0.5 rounded-lg font-semibold backdrop-blur-md">
              {listing.category}
            </span>
            <span className="bg-slate-950/80 text-slate-300 text-xs px-2 py-0.5 rounded-lg border border-slate-800 backdrop-blur-md">
              {listing.condition}
            </span>
          </div>

          <button
            onClick={onSave}
            className={`absolute top-3 right-3 p-2 rounded-xl backdrop-blur-md transition ${
              listing.isSaved
                ? 'bg-rose-500/80 text-white'
                : 'bg-slate-950/80 text-slate-400 hover:text-white'
            }`}
          >
            <Heart className="w-4 h-4 fill-current" />
          </button>

          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <div className="bg-slate-950/90 text-amber-400 font-extrabold text-lg px-3 py-1 rounded-xl border border-amber-500/30 backdrop-blur-md">
              ${listing.price}
            </div>
            {listing.originalPrice && (
              <span className="text-slate-400 line-through text-xs bg-slate-950/80 px-2 py-0.5 rounded">
                ${listing.originalPrice}
              </span>
            )}
          </div>
        </div>

        {/* Card Body */}
        <div className="p-5">
          <h3
            onClick={onInspect}
            className="text-base font-bold text-slate-100 hover:text-amber-300 cursor-pointer transition line-clamp-2 mb-2"
          >
            {listing.title}
          </h3>

          <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-3">
            <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">{listing.location}</span>
          </div>

          <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed mb-4">
            {listing.description}
          </p>

          <div className="flex flex-wrap gap-1.5 mb-4">
            {listing.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="bg-slate-950 text-slate-400 border border-slate-800 text-[11px] px-2 py-0.5 rounded-md">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Seller Info */}
      <div className="px-5 pb-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src={listing.sellerAvatar} alt={listing.sellerName} className="w-7 h-7 rounded-full border border-slate-700" />
          <div>
            <div className="text-xs font-semibold text-slate-200 flex items-center gap-1">
              {listing.sellerName}
              {listing.isVerifiedStudent && <CheckCircle className="w-3 h-3 text-emerald-400" />}
            </div>
            <div className="text-[10px] text-slate-500">{listing.postedDate}</div>
          </div>
        </div>

        <button
          onClick={onInspect}
          className="bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-amber-500/30 transition flex items-center gap-1"
        >
          <MessageCircle className="w-3.5 h-3.5" /> Details
        </button>
      </div>
    </div>
  );
}
