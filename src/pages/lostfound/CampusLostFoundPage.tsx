import React, { useState } from 'react';
import { Search, Filter, PlusCircle, MapPin, Calendar, CheckCircle2, AlertTriangle, ShieldCheck, Sparkles, UserCheck, Activity, Flame, ShieldAlert, PackageCheck } from 'lucide-react';
import LostItemCard, { LostFoundItem } from '../../components/lostfound/LostItemCard';
import LostFoundActivityTimeline from '../../components/lostfound/LostFoundActivityTimeline';

const INITIAL_ITEMS: LostFoundItem[] = [
  {
    id: 'item-801',
    itemTitle: 'Apple AirPods Pro Gen 2 (MagSafe Case in Black Silicone)',
    itemCategory: 'Electronics',
    reportType: 'LOST',
    location: 'Engineering Library - 2nd Floor Reading Room',
    dateReported: 'Yesterday @ 4:15 PM',
    rewardAmountUSD: 40,
    finderName: 'Elena Rostova',
    finderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    verificationStatus: 'Student Verified',
    description: 'Left my AirPods case on table #14 near the window. Case has a small blue key ring attached.',
    isClaimed: false,
    status: 'ACTIVE_SEARCH',
  },
  {
    id: 'item-802',
    itemTitle: 'Hydro Flask 32oz Water Bottle (Cobalt Blue with Stickers)',
    itemCategory: 'Personal Belongings',
    reportType: 'FOUND',
    location: 'Student Union Food Court - Booth 6',
    dateReported: 'Today @ 11:30 AM',
    rewardAmountUSD: 0,
    finderName: 'Marcus Vance',
    finderAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    verificationStatus: 'Student Verified',
    description: 'Found this water bottle left on a booth table. Turn into Student Union info desk or contact me directly.',
    isClaimed: false,
    status: 'ACTIVE_SEARCH',
  },
  {
    id: 'item-803',
    itemTitle: 'TI-84 Plus CE Graphing Calculator (Pink Edition)',
    itemCategory: 'Academic Supplies',
    reportType: 'FOUND',
    location: 'Math Building - Room 302 Desk',
    dateReported: '2 days ago',
    rewardAmountUSD: 0,
    finderName: 'David Chen',
    finderAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    verificationStatus: 'Student Verified',
    description: 'Calculated left behind after MATH 220 midterm exam. Name label on back matches "Sarah J."',
    isClaimed: true,
    status: 'REUNITED',
  },
];

export default function CampusLostFoundPage() {
  const [items, setItems] = useState<LostFoundItem[]>(INITIAL_ITEMS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeTab, setActiveTab] = useState<'feed' | 'activity' | 'my-reports'>('feed');
  const [selectedItemModal, setSelectedItemModal] = useState<LostFoundItem | null>(null);

  const categories = ['All', 'Electronics', 'Personal Belongings', 'Academic Supplies', 'Keys & IDs'];

  const toggleClaim = (id: string) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id === id) {
          const nextClaimed = !item.isClaimed;
          return {
            ...item,
            isClaimed: nextClaimed,
            status: nextClaimed ? 'REUNITED' : 'ACTIVE_SEARCH',
          };
        }
        return item;
      })
    );
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.itemTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.itemCategory === selectedCategory;
    const matchesTab = activeTab !== 'my-reports' || item.isClaimed;

    return matchesSearch && matchesCategory && matchesTab;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header Banner */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-amber-950 via-orange-950 to-slate-900 border border-amber-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-amber-500/20 text-amber-300 text-xs px-3 py-1 rounded-full font-semibold border border-amber-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> CampusConnect Item Recovery
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> Student Verification Required
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-amber-200 bg-clip-text text-transparent">
              Campus Lost & Found Recovery Hub
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Report lost items, upload found belongings, offering verified student handshakes and campus location tracking to reunite items quickly.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-amber-600/30 transition flex items-center gap-2 border border-amber-400/20 text-sm">
              <PlusCircle className="w-4 h-4" /> Report Lost / Found Item
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto space-y-6">
        {/* Navigation Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('feed')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'feed'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <PackageCheck className="w-4 h-4" /> Item Feed
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'activity'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Activity className="w-4 h-4" /> Reunited Stream
            </button>
            <button
              onClick={() => setActiveTab('my-reports')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'my-reports'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" /> Reunited Items ({items.filter(i => i.isClaimed).length})
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search lost or found items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-amber-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'activity' ? (
          <LostFoundActivityTimeline />
        ) : (
          <>
            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-2">Category:</span>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                    selectedCategory === cat
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredItems.map((item) => (
                <LostItemCard
                  key={item.id}
                  item={item}
                  onClaim={() => toggleClaim(item.id)}
                  onInspect={() => setSelectedItemModal(item)}
                />
              ))}
            </div>

            {filteredItems.length === 0 && (
              <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800/60">
                <ShieldAlert className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-300">No lost/found reports match criteria</h3>
                <p className="text-slate-500 text-sm mt-1">Try updating your filters or search keywords.</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal View */}
      {selectedItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedItemModal(null)}
              className="absolute right-5 top-5 text-slate-400 hover:text-white text-xl font-bold"
            >
              ×
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs px-2.5 py-0.5 rounded font-mono font-bold ${
                selectedItemModal.reportType === 'LOST'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}>
                {selectedItemModal.reportType}
              </span>
              <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded font-semibold">
                {selectedItemModal.itemCategory}
              </span>
            </div>

            <h2 className="text-xl font-bold text-white mb-2">{selectedItemModal.itemTitle}</h2>
            <p className="text-slate-400 text-xs leading-relaxed mb-4">{selectedItemModal.description}</p>

            <div className="space-y-2 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-6 text-xs font-mono">
              <div className="flex items-center gap-2 text-slate-300">
                <MapPin className="w-4 h-4 text-amber-400" />
                <span>Location: {selectedItemModal.location}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Calendar className="w-4 h-4 text-cyan-400" />
                <span>Reported: {selectedItemModal.dateReported}</span>
              </div>
              {selectedItemModal.rewardAmountUSD > 0 && (
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <span>Offered Reward: ${selectedItemModal.rewardAmountUSD} USD</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSelectedItemModal(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs transition"
              >
                Close
              </button>
              <button
                onClick={() => {
                  toggleClaim(selectedItemModal.id);
                  setSelectedItemModal(null);
                }}
                className={`px-5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                  selectedItemModal.isClaimed
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/30'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                {selectedItemModal.isClaimed ? 'Mark Active Search' : 'Mark Reunited / Claimed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
