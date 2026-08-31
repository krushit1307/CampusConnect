import React, { useState } from 'react';
import { Tag, Users, TrendingUp, DollarSign, CheckCircle2, RefreshCcw, AlertTriangle, ShoppingCart, Zap, BadgeDollarSign, SlidersHorizontal } from 'lucide-react';

interface DiscountTier {
  id: string;
  groupSize: number;
  discountPercent: number;
  label: string;
}

const INITIAL_TIERS: DiscountTier[] = [
  { id: 't-1', groupSize: 5, discountPercent: 10, label: 'Starter Pack' },
  { id: 't-2', groupSize: 10, discountPercent: 15, label: 'Squad Deal' },
  { id: 't-3', groupSize: 25, discountPercent: 25, label: 'Campus Crew' },
  { id: 't-4', groupSize: 50, discountPercent: 40, label: 'Bulk Blast' },
];

const BASE_TICKET_PRICE = 50;

export default function DynamicPricing() {
  const [tiers, setTiers] = useState<DiscountTier[]>(INITIAL_TIERS);
  const [selectedTierId, setSelectedTierId] = useState<string>(INITIAL_TIERS[0].id);
  const [quantity, setQuantity] = useState<number>(5);
  const [notification, setNotification] = useState('');

  const selectedTier = tiers.find(tier => tier.id === selectedTierId) || INITIAL_TIERS[0];
  
  const totalPrice = quantity * BASE_TICKET_PRICE;
  const discountAmount = Math.round((totalPrice * selectedTier.discountPercent) / 100);
  const finalPrice = totalPrice - discountAmount;
  const pricePerTicket = Math.round(finalPrice / quantity);

  const updateDiscount = (tierId: string, newDiscount: number) => {
    setTiers(prev => prev.map(tier => 
      tier.id === tierId ? { ...tier, discountPercent: Math.max(0, Math.min(90, newDiscount)) } : tier
    ));
    setNotification('Discount tier updated successfully!');
    setTimeout(() => setNotification(''), 3000);
  };

  const resetPricing = () => {
    setTiers(INITIAL_TIERS);
    setSelectedTierId(INITIAL_TIERS[0].id);
    setQuantity(5);
    setNotification('');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="bg-gradient-to-r from-lime-900/60 via-green-900/40 to-slate-900 border border-lime-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="absolute -right-10 -top-10 w-72 h-72 bg-lime-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-lime-500/20 text-lime-300 text-xs px-3 py-1 rounded-full font-semibold border border-lime-500/30 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> Smart Pricing
                </span>
                <span className="text-slate-400 text-xs flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-green-400" /> Real-Time Adjustments
                </span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-lime-200 bg-clip-text text-transparent">
                Real-Time Dynamic Pricing Group Discount Tiers
              </h1>
              <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
                Automatically calculate group discounts based on the number of tickets purchased.
              </p>
            </div>
            <button onClick={resetPricing} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 rounded-xl font-medium transition flex items-center gap-2 border border-slate-700 text-sm">
              <RefreshCcw className="w-4 h-4" /> Reset Pricing
            </button>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-lime-500/10 rounded-xl"><Tag className="w-6 h-6 text-lime-400" /></div>
              <div>
                <p className="text-2xl font-bold">{tiers.length}</p>
                <p className="text-slate-400 text-xs">Discount Tiers</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 rounded-xl"><DollarSign className="w-6 h-6 text-emerald-400" /></div>
              <div>
                <p className="text-2xl font-bold">${BASE_TICKET_PRICE}</p>
                <p className="text-slate-400 text-xs">Base Ticket Price</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-500/10 rounded-xl"><Users className="w-6 h-6 text-yellow-400" /></div>
              <div>
                <p className="text-2xl font-bold">{quantity}</p>
                <p className="text-slate-400 text-xs">Selected Quantity</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Configurator */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Tier List */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-6"><SlidersHorizontal className="w-5 h-5 text-lime-400" /> Configure Tiers</h2>
            <div className="space-y-4">
              {tiers.map(tier => (
                <div 
                  key={tier.id} 
                  className={`bg-slate-800/50 rounded-xl p-4 cursor-pointer transition border ${selectedTierId === tier.id ? 'border-lime-500/30 bg-lime-500/5' : 'border-slate-700'}`}
                  onClick={() => setSelectedTierId(tier.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold text-white">{tier.label}</p>
                      <p className="text-xs text-slate-400">{tier.groupSize}+ Tickets</p>
                    </div>
                    <span className="text-2xl font-bold text-lime-400">{tier.discountPercent}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Adjust:</span>
                    <input 
                      type="range" 
                      min={0} 
                      max={90} 
                      value={tier.discountPercent}
                      onChange={(e) => updateDiscount(tier.id, Number(e.target.value))}
                      className="flex-1 accent-lime-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Price Calculator */}
          <div className="bg-slate-900/80 border border-lime-500/20 rounded-3xl p-8">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-6"><BadgeDollarSign className="w-5 h-5 text-lime-400" /> Live Price Calculator</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Number of Tickets</label>
                <input 
                  type="number" 
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-lime-500"
                />
              </div>

              <div className="bg-slate-800/50 rounded-2xl p-6 space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Base Price ({quantity} x ${BASE_TICKET_PRICE})</span>
                  <span className="text-white font-bold">${totalPrice}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Applied Discount ({selectedTier.label} - {selectedTier.discountPercent}%)</span>
                  <span className="text-rose-400 font-bold">-${discountAmount}</span>
                </div>
                <div className="border-t border-slate-700 pt-4 flex justify-between">
                  <span className="text-lg font-bold text-white">Total Price</span>
                  <span className="text-2xl font-extrabold text-lime-400">${finalPrice}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Price Per Ticket</span>
                  <span className="text-emerald-400 font-bold">${pricePerTicket}</span>
                </div>
              </div>

              <button className="w-full bg-lime-600 hover:bg-lime-500 text-white py-3 rounded-xl font-medium transition shadow-lg shadow-lime-600/30 flex items-center justify-center gap-2">
                <ShoppingCart className="w-4 h-4" /> Purchase Tickets
              </button>
            </div>
          </div>
        </div>

        {/* Warning Note */}
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3 bg-yellow-500/20 rounded-full">
            <AlertTriangle className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <h3 className="font-bold text-yellow-300">Real-Time Simulation</h3>
            <p className="text-slate-400 text-sm">This is a standalone frontend component. It does not modify any existing backend data or financial systems.</p>
          </div>
        </div>

        {/* Notification */}
        {notification && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-sm text-emerald-300 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5" />
            {notification}
          </div>
        )}

      </div>
    </div>
  );
}