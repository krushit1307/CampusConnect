import React from 'react';
import { MarketplaceListing } from '@/types/marketplace';
import { ShieldCheck, Clock, Tag, MapPin, Gavel, DollarSign } from 'lucide-react';

interface MarketplaceListingCardProps {
  listing: MarketplaceListing;
  onBidClick?: (listing: MarketplaceListing) => void;
  onBuyClick?: (listing: MarketplaceListing) => void;
}

export function MarketplaceListingCard({
  listing,
  onBidClick,
  onBuyClick,
}: MarketplaceListingCardProps) {
  const isAuction = listing.type === 'auction';
  const highestBid = listing.currentBid || listing.price;

  const categoryLabels: Record<string, string> = {
    textbooks: 'Textbook',
    electronics: 'Electronics',
    sublets: 'Housing / Sublet',
    furniture: 'Furniture',
    supplies: 'School Supplies',
    services: 'Tutoring & Services',
  };

  const conditionLabels: Record<string, string> = {
    new: 'Brand New',
    like_new: 'Like New',
    good: 'Good Condition',
    fair: 'Fair',
  };

  return (
    <div className="flex flex-col bg-white border-2 border-black rounded-lg overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all duration-200">
      {/* Image Thumbnail */}
      <div className="relative aspect-4/3 w-full bg-slate-100 border-b-2 border-black overflow-hidden group">
        {listing.images && listing.images[0] ? (
          <img
            src={listing.images[0]}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-lime/20 to-brand-amber-base/20 font-mono text-sm font-bold text-gray-400">
            No Image Provided
          </div>
        )}

        {/* Listing Type Tag */}
        <div className="absolute top-2 left-2 flex gap-1">
          {isAuction ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-400 border-2 border-black rounded font-mono text-xs font-black uppercase text-black shadow-xs">
              <Gavel size={12} /> Auction
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-lime border-2 border-black rounded font-mono text-xs font-black uppercase text-black shadow-xs">
              <DollarSign size={12} /> Buy Now
            </span>
          )}

          {listing.escrowProtected && (
            <span
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500 text-white border-2 border-black rounded font-mono text-xs font-bold shadow-xs"
              title="Protected by Campus Escrow"
            >
              <ShieldCheck size={12} /> Escrow
            </span>
          )}
        </div>

        {/* Condition Badge */}
        <div className="absolute bottom-2 right-2">
          <span className="px-2 py-0.5 bg-black text-white font-mono text-[10px] font-bold uppercase rounded">
            {conditionLabels[listing.condition] || listing.condition}
          </span>
        </div>
      </div>

      {/* Content Info */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs font-mono text-gray-500 mb-1">
            <span className="flex items-center gap-1">
              <Tag size={12} /> {categoryLabels[listing.category] || listing.category}
            </span>
            <span className="flex items-center gap-1">
              <MapPin size={12} /> {listing.location}
            </span>
          </div>

          <h3 className="font-display font-black text-lg text-black line-clamp-1 mb-1">
            {listing.title}
          </h3>

          <p className="font-mono text-xs text-gray-600 line-clamp-2 mb-3">
            {listing.description}
          </p>
        </div>

        {/* Price and CTA */}
        <div className="pt-3 border-t-2 border-slate-100 flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] text-gray-500 uppercase">
              {isAuction ? 'Highest Bid' : 'Price'}
            </div>
            <div className="font-display font-black text-xl text-black">
              ${highestBid.toFixed(2)}
            </div>
          </div>

          {isAuction ? (
            <button
              onClick={() => onBidClick?.(listing)}
              className="neu-border bg-amber-300 hover:bg-amber-400 px-3 py-1.5 font-mono text-xs font-black uppercase text-black flex items-center gap-1.5 transition-transform active:scale-95"
            >
              <Gavel size={14} /> Bid (${listing.bids.length})
            </button>
          ) : (
            <button
              onClick={() => onBuyClick?.(listing)}
              className="neu-border bg-lime hover:bg-lime/90 px-3 py-1.5 font-mono text-xs font-black uppercase text-black flex items-center gap-1.5 transition-transform active:scale-95"
            >
              Buy with Escrow
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
