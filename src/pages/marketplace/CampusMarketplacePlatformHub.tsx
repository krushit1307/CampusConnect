import React, { useState } from 'react';
import { ShoppingBag, Search, PlusCircle, CheckCircle2 } from 'lucide-react';
import { MOCK_MARKETPLACE_ITEMS, filterMarketplaceItems, MarketplaceItem } from '../../services/campusMarketplaceEngine';
import { MarketplaceItemCardTile } from './MarketplaceItemCardTile';

export const CampusMarketplacePlatformHub: React.FC = () => {
    const [items] = useState<MarketplaceItem[]>(MOCK_MARKETPLACE_ITEMS);
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [contactedItem, setContactedItem] = useState<string | null>(null);

    const filtered = filterMarketplaceItems(items, selectedCategory).filter(i =>
        i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (i.courseCode && i.courseCode.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const handleContactSeller = (item: MarketplaceItem) => {
        setContactedItem(item.title);
        setTimeout(() => setContactedItem(null), 3000);
    };

    return (
        <div className="w-full max-w-6xl mx-auto space-y-6 text-slate-100 font-sans p-4">
            {/* Header Banner */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                        <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                            <ShoppingBag className="w-4 h-4" /> Peer-to-Peer Student Exchange
                        </div>
                        <h1 className="text-2xl font-black text-slate-100 mt-1">Campus Marketplace & Textbook Hub</h1>
                    </div>

                    <button
                        type="button"
                        className="px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                    >
                        <PlusCircle className="w-4 h-4" /> Post New Listing
                    </button>
                </div>

                {contactedItem && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> Direct chat room opened with seller for "{contactedItem}"!
                    </div>
                )}

                {/* Filter & Search Controls */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search listings by textbook title or course code (e.g. CS301, Monitor)..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                    </div>

                    <div className="flex gap-2">
                        {['All', 'Textbooks', 'Electronics', 'Dorm Goods'].map(cat => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all ${
                                    selectedCategory === cat
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Listings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {filtered.map(item => (
                    <MarketplaceItemCardTile
                        key={item.id}
                        item={item}
                        onContactSeller={handleContactSeller}
                    />
                ))}
            </div>
        </div>
    );
};

export default CampusMarketplacePlatformHub;
