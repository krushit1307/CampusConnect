import React from 'react';
import { Tag, BookOpen, MessageCircle, DollarSign } from 'lucide-react';
import { MarketplaceItem } from '../../services/campusMarketplaceEngine';

interface ItemCardProps {
    item: MarketplaceItem;
    onContactSeller: (item: MarketplaceItem) => void;
}

export const MarketplaceItemCardTile: React.FC<ItemCardProps> = ({ item, onContactSeller }) => {
    return (
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-3 shadow-lg hover:border-slate-700 transition-all flex flex-col justify-between">
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[10px] font-bold uppercase">
                        {item.category}
                    </span>
                    {item.courseCode && (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-[10px] font-bold flex items-center gap-1">
                            <BookOpen className="w-3 h-3" /> {item.courseCode}
                        </span>
                    )}
                </div>

                <h3 className="text-base font-bold text-slate-100">{item.title}</h3>
                <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 font-medium">Condition:</span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-bold text-[10px]">
                        {item.condition}
                    </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">{item.description}</p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <div>
                    <span className="text-xs font-mono font-bold text-emerald-400 flex items-center">
                        <DollarSign className="w-3.5 h-3.5" />{item.priceUSD} USD
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block">Seller: {item.sellerName}</span>
                </div>

                <button
                    type="button"
                    onClick={() => onContactSeller(item)}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-500/20 flex items-center gap-1.5"
                >
                    <MessageCircle className="w-3.5 h-3.5" /> Make Offer
                </button>
            </div>
        </div>
    );
};
