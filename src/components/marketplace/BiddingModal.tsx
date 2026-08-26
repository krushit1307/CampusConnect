import React, { useState } from 'react';
import { MarketplaceListing, Bid } from '@/types/marketplace';
import { X, Gavel, ShieldCheck, ArrowUpRight, History } from 'lucide-react';

interface BiddingModalProps {
  listing: MarketplaceListing;
  isOpen: boolean;
  onClose: () => void;
  onPlaceBid: (listingId: string, amount: number) => void;
  currentUser: { id: string; name: string };
}

export function BiddingModal({
  listing,
  isOpen,
  onClose,
  onPlaceBid,
  currentUser,
}: BiddingModalProps) {
  const currentHighest = listing.currentBid || listing.price;
  const minNextBid = currentHighest + 5;
  const [bidAmount, setBidAmount] = useState<number>(minNextBid);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (bidAmount < minNextBid) {
      setError(`Minimum bid increment is $5. Minimum allowed bid is $${minNextBid}.`);
      return;
    }
    setError(null);
    onPlaceBid(listing.id, bidAmount);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white border-4 border-black rounded-lg max-w-lg w-full p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative animate-in fade-in zoom-in duration-150">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 border-2 border-black rounded hover:bg-gray-100 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-amber-300 border-2 border-black rounded">
            <Gavel size={20} />
          </div>
          <div>
            <h2 className="text-xl font-display font-black text-black">
              Place Competitive Bid
            </h2>
            <p className="text-xs font-mono text-gray-600 line-clamp-1">{listing.title}</p>
          </div>
        </div>

        {/* Current State Highlights */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-3 bg-slate-50 border-2 border-black rounded">
            <div className="font-mono text-[10px] text-gray-500 uppercase">Current High Bid</div>
            <div className="font-display font-black text-2xl text-black">
              ${currentHighest.toFixed(2)}
            </div>
          </div>
          <div className="p-3 bg-slate-50 border-2 border-black rounded">
            <div className="font-mono text-[10px] text-gray-500 uppercase">Min Next Bid</div>
            <div className="font-display font-black text-2xl text-emerald-600">
              ${minNextBid.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Bid Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-mono text-xs font-bold uppercase mb-1">
              Your Max Bid ($ USD)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-gray-500">
                $
              </span>
              <input
                type="number"
                step="1"
                min={minNextBid}
                value={bidAmount}
                onChange={(e) => {
                  setBidAmount(Number(e.target.value));
                  setError(null);
                }}
                className="w-full pl-8 pr-4 py-2.5 border-2 border-black font-mono font-bold text-lg rounded bg-white outline-hidden focus:ring-2 focus:ring-amber-400"
              />
            </div>
            {error && (
              <p className="mt-1 font-mono text-xs text-red-600 font-bold">{error}</p>
            )}
          </div>

          <div className="flex items-center gap-2 p-3 bg-blue-50 border-2 border-blue-200 rounded text-xs font-mono text-blue-900">
            <ShieldCheck size={16} className="text-blue-600 shrink-0" />
            <span>
              Your funds are held securely in campus escrow and only debited if your bid wins when the timer expires.
            </span>
          </div>

          {/* Quick Increment Buttons */}
          <div className="flex gap-2">
            {[5, 10, 25, 50].map((inc) => (
              <button
                key={inc}
                type="button"
                onClick={() => setBidAmount((prev) => Math.max(minNextBid, prev + inc))}
                className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 border border-black rounded font-mono text-xs font-bold"
              >
                +${inc}
              </button>
            ))}
          </div>

          {/* Bid History Accordion */}
          {listing.bids.length > 0 && (
            <div className="border-t-2 border-slate-200 pt-3">
              <div className="flex items-center gap-1 font-mono text-xs font-bold text-gray-600 mb-2">
                <History size={14} /> Bid History ({listing.bids.length})
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1 pr-1 font-mono text-xs">
                {listing.bids.map((b) => (
                  <div
                    key={b.id}
                    className="flex justify-between items-center px-2 py-1 bg-slate-50 border border-slate-200 rounded"
                  >
                    <span>{b.bidderName}</span>
                    <span className="font-bold">${b.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
              className="flex-1 py-2.5 bg-amber-300 hover:bg-amber-400 border-2 border-black rounded font-mono text-xs font-black uppercase flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5"
            >
              Confirm Bid <ArrowUpRight size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
