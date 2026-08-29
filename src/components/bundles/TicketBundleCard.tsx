import React from "react";
import { TicketBundle, BundleEventItem } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Calendar, CheckCircle, AlertTriangle } from "lucide-react";

interface TicketBundleCardProps {
  bundle: TicketBundle;
  events: BundleEventItem[];
  isAvailable: boolean;
  soldOutEventName?: string | null;
  onPurchase: (bundleId: string) => void;
  loading?: boolean;
}

export const TicketBundleCard: React.FC<TicketBundleCardProps> = ({
  bundle,
  events,
  isAvailable,
  soldOutEventName,
  onPurchase,
  loading = false,
}) => {
  const savings = (bundle.original_total_price - bundle.price_dollars).toFixed(2);

  return (
    <div className="neu-border bg-white p-6 flex flex-col justify-between shadow-[4px_4px_0_0_var(--color-ink,#000)] hover:shadow-[6px_6px_0_0_var(--color-ink,#000)] transition-all">
      <div>
        <div className="flex justify-between items-start mb-3">
          <Badge className="bg-indigo-600 text-white font-mono font-bold text-xs uppercase px-2 py-1 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            Season Pass Bundle
          </Badge>
          <Badge variant="outline" className="neu-border bg-emerald-100 text-emerald-800 font-bold">
            Save ${savings} ({bundle.discount_percentage}%)
          </Badge>
        </div>

        <h3 className="text-2xl font-black text-slate-900 mb-2">{bundle.bundle_name}</h3>
        {bundle.description && <p className="text-slate-600 text-sm mb-4">{bundle.description}</p>}

        <div className="my-4 p-4 neu-border bg-slate-50 rounded-md">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-sm font-semibold text-slate-700">Bundle Price:</span>
            <div className="text-right">
              <span className="text-2xl font-black text-emerald-600 font-mono">
                ${bundle.price_dollars.toFixed(2)}
              </span>
              <span className="text-xs text-slate-400 line-through ml-2 font-mono">
                ${bundle.original_total_price.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2 mb-6">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Included Events ({events.length}):
          </p>
          <ul className="space-y-2">
            {events.map((evt) => (
              <li
                key={evt.event_id}
                className="flex justify-between items-center text-sm p-2 rounded neu-border bg-white"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <Calendar className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                  <span className="font-semibold truncate text-slate-800">{evt.event_title}</span>
                </div>
                {evt.is_sold_out ? (
                  <Badge variant="destructive" className="text-[10px] font-bold">
                    Sold Out
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] font-medium bg-slate-100">
                    Included
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        {!isAvailable ? (
          <div className="neu-border bg-rose-50 p-3 mb-3 text-rose-700 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Unavailable: Event &apos;{soldOutEventName}&apos; is sold out.</span>
          </div>
        ) : (
          <div className="text-xs text-slate-500 mb-3 flex items-center gap-1.5 font-medium">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>Includes guaranteed RSVP to all {events.length} events</span>
          </div>
        )}

        <Button
          onClick={() => onPurchase(bundle.id)}
          disabled={!isAvailable || loading}
          className="neu-border neu-press w-full py-6 text-lg font-black bg-emerald-500 hover:bg-emerald-600 text-white uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Processing..." : `Get Season Pass ($${bundle.price_dollars.toFixed(2)})`}
        </Button>
      </div>
    </div>
  );
};
