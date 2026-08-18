import React from 'react';
import { ShoppingBag, CheckCircle2, Clock, ShieldCheck, DollarSign, ArrowUpRight } from 'lucide-react';

interface TradeActivity {
  id: string;
  buyerName: string;
  sellerName: string;
  itemTitle: string;
  category: string;
  soldPrice: number;
  completedAgo: string;
}

const RECENT_TRADES: TradeActivity[] = [
  {
    id: 'trd-1',
    buyerName: 'Lucas Vance',
    sellerName: 'Jason Reed',
    itemTitle: 'Apple iPad Pro 11" M2 + Apple Pencil 2',
    category: 'Electronics',
    soldPrice: 620,
    completedAgo: '30 mins ago',
  },
  {
    id: 'trd-2',
    buyerName: 'Sophia Lin',
    sellerName: 'Maya Lin',
    itemTitle: 'Calculus Early Transcendentals (9th Edition)',
    category: 'Textbooks',
    soldPrice: 35,
    completedAgo: '2 hours ago',
  },
  {
    id: 'trd-3',
    buyerName: 'Ethan Wright',
    sellerName: 'Chloe Bennett',
    itemTitle: 'Dorm Mini Fridge & Microwave Combo Unit',
    category: 'Furniture',
    soldPrice: 95,
    completedAgo: '4 hours ago',
  },
];

export default function MarketplaceActivityTimeline() {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-md">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">$42,850</div>
            <div className="text-slate-400 text-xs font-medium">Monthly Campus Trade Volume</div>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">100%</div>
            <div className="text-slate-400 text-xs font-medium">Student Verified Handshakes</div>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-orange-500/10 text-orange-400 rounded-xl border border-orange-500/20">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">$145.00</div>
            <div className="text-slate-400 text-xs font-medium">Avg Student Savings Per Item</div>
          </div>
        </div>
      </div>

      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <Clock className="w-5 h-5 text-amber-400" /> Recent Campus Peer Exchanges
      </h3>

      <div className="space-y-4">
        {RECENT_TRADES.map((trade) => (
          <div
            key={trade.id}
            className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-5 hover:border-amber-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-amber-500/10 text-amber-400 text-[11px] px-2 py-0.5 rounded border border-amber-500/20 font-semibold">
                  {trade.category}
                </span>
                <span className="text-slate-500 text-xs">{trade.completedAgo}</span>
              </div>
              <h4 className="text-base font-bold text-slate-100">{trade.itemTitle}</h4>
              <div className="text-xs text-slate-400 mt-1">
                Sold by <span className="text-slate-200 font-semibold">{trade.sellerName}</span> to{' '}
                <span className="text-slate-200 font-semibold">{trade.buyerName}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-emerald-400 font-mono font-extrabold text-lg bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20">
                ${trade.soldPrice}
              </div>
              <div className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Exchange Complete
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
