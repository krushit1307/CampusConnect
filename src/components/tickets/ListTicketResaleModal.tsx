import React, { useState } from "react";
import {
  TicketResalePriceCapEngine,
  ResaleMarketplaceListing,
} from "@/services/ticketResalePriceCapEngine";
import { ShieldCheck, DollarSign, Tag, AlertCircle, X, Check } from "lucide-react";

interface ListTicketResaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string;
  eventId: string;
  eventTitle: string;
  originalPrice: number;
  tierName: string;
  currentUserId: string;
  currentUserName: string;
  onListingCreated: (listing: ResaleMarketplaceListing) => void;
}

export const ListTicketResaleModal: React.FC<ListTicketResaleModalProps> = ({
  isOpen,
  onClose,
  ticketId,
  eventId,
  eventTitle,
  originalPrice,
  tierName,
  currentUserId,
  currentUserName,
  onListingCreated,
}) => {
  const [askingPrice, setAskingPrice] = useState<number>(originalPrice);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const isAboveCap = askingPrice > originalPrice;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isAboveCap) {
      setError(
        `Resale price cannot exceed the original face value ($${originalPrice.toFixed(2)}).`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const listing = TicketResalePriceCapEngine.listTicketForResale({
        ticketId,
        eventId,
        eventTitle,
        sellerUserId: currentUserId,
        sellerName: currentUserName,
        originalPrice,
        resalePrice: askingPrice,
        tierName,
      });

      onListingCreated(listing);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to list ticket");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              List Ticket for Resale
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{eventTitle}</p>
          </div>
        </div>

        {/* Anti-Scalping Policy Banner */}
        <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Anti-Scalping Fair Price Guarantee
          </div>
          <p className="text-[11px] leading-relaxed text-blue-700 dark:text-blue-300">
            In compliance with university equitable access standards, tickets cannot be sold for
            more than the original purchase price (${originalPrice.toFixed(2)}).
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Asking Price ($ USD)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                $
              </span>
              <input
                type="number"
                step="0.50"
                min="0"
                max={originalPrice}
                value={askingPrice}
                onChange={(e) => setAskingPrice(Number(e.target.value))}
                required
                className={`w-full pl-8 pr-4 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold focus:outline-none focus:ring-2 ${
                  isAboveCap
                    ? "border-red-500 focus:ring-red-500"
                    : "border-slate-300 dark:border-slate-700 focus:ring-emerald-500"
                }`}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Original Face Value: ${originalPrice.toFixed(2)}</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                Max Allowed: ${originalPrice.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Tier:</span>
              <span className="font-semibold text-slate-900 dark:text-white">{tierName}</span>
            </div>
            <div className="flex justify-between">
              <span>Seller Payout (100% of Asking):</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                ${askingPrice.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isAboveCap}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-md transition-all"
            >
              {isSubmitting ? "Listing..." : "Confirm & Post Listing"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
