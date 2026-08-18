import React, { useState } from 'react';
import { Home, Search, Filter, PlusCircle, Calendar, MapPin, DollarSign, Sparkles, ShieldCheck, CheckCircle2, UserCheck, Activity, Flame, ShieldAlert } from 'lucide-react';
import SubletListingCard, { SubletListing } from '../../components/housing/SubletListingCard';
import HousingActivityTimeline from '../../components/housing/HousingActivityTimeline';

const INITIAL_SUBLETS: SubletListing[] = [
  {
    id: 'sub-601',
    propertyTitle: 'Modern Luxury Studio - 2 Mins Walk to Science Quad',
    location: '402 University Ave, Apartment 3B',
    leaseTerm: 'Summer 2026 (May 15 - Aug 20)',
    monthlyRentUSD: 950,
    depositUSD: 500,
    roomType: 'Private Studio',
    bedrooms: 1,
    bathrooms: 1,
    isUtilitiesIncluded: true,
    isFurnished: true,
    posterName: 'Chloe Bennett',
    posterAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    verificationStatus: 'Student Verified',
    description: 'Sunlit top-floor studio featuring floor-to-ceiling windows, high-speed fiber internet, in-unit washer/dryer, and fully furnished study desk setup.',
    isBookmarked: false,
    status: 'AVAILABLE',
  },
  {
    id: 'sub-602',
    propertyTitle: 'Spacious Master Bedroom in 4BDR Campus Townhouse',
    location: '118 College Ave, Townhouse #4',
    leaseTerm: 'Fall 2026 Semester (Aug - Dec)',
    monthlyRentUSD: 720,
    depositUSD: 350,
    roomType: 'Private Room (Shared Bath)',
    bedrooms: 4,
    bathrooms: 2,
    isUtilitiesIncluded: false,
    isFurnished: true,
    posterName: 'Liam O\'Connor',
    posterAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    verificationStatus: 'Student Verified',
    description: 'Looking for a clean, friendly roommate to sublet my master bedroom! Includes off-street parking spot, spacious patio, and central heating.',
    isBookmarked: true,
    status: 'AVAILABLE',
  },
  {
    id: 'sub-603',
    propertyTitle: 'Cozy 1BDR Apartment Near Engineering Quad',
    location: '709 Highland Rd, Apt 12',
    leaseTerm: 'Full Academic Year Sublet',
    monthlyRentUSD: 1100,
    depositUSD: 600,
    roomType: 'Entire Apartment',
    bedrooms: 1,
    bathrooms: 1,
    isUtilitiesIncluded: true,
    isFurnished: false,
    posterName: 'Samantha Lin',
    posterAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    verificationStatus: 'Student Verified',
    description: 'Quiet residential unit ideal for graduate students or focused undergrads. Pet-friendly with approval, bike storage room in basement.',
    isBookmarked: false,
    status: 'PENDING_LEASE',
  },
];

export default function CampusHousingSubletPage() {
  const [sublets, setSublets] = useState<SubletListing[]>(INITIAL_SUBLETS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoomType, setSelectedRoomType] = useState('All');
  const [activeTab, setActiveTab] = useState<'discover' | 'activity' | 'saved'>('discover');
  const [selectedSubletModal, setSelectedSubletModal] = useState<SubletListing | null>(null);

  const roomTypes = ['All', 'Private Studio', 'Private Room (Shared Bath)', 'Entire Apartment'];

  const toggleBookmark = (id: string) => {
    setSublets(prev =>
      prev.map(item => item.id === id ? { ...item, isBookmarked: !item.isBookmarked } : item)
    );
  };

  const filteredSublets = sublets.filter(item => {
    const matchesSearch = item.propertyTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.leaseTerm.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedRoomType === 'All' || item.roomType === selectedRoomType;
    const matchesTab = activeTab !== 'saved' || item.isBookmarked;

    return matchesSearch && matchesType && matchesTab;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header Banner */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 border border-emerald-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-emerald-500/20 text-emerald-300 text-xs px-3 py-1 rounded-full font-semibold border border-emerald-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> CampusConnect Peer Housing
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> 100% Student Verified Leases
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-emerald-200 bg-clip-text text-transparent">
              Campus Housing & Sublet Finder
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Discover verified student sublets, lease transfers, and roommate matching close to campus quads with zero broker fees.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-emerald-600/30 transition flex items-center gap-2 border border-emerald-400/20 text-sm">
              <PlusCircle className="w-4 h-4" /> Post Sublet Listing
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
              onClick={() => setActiveTab('discover')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'discover'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Home className="w-4 h-4" /> Discover Listings
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'activity'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Activity className="w-4 h-4" /> Sublet Activity Feed
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'saved'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" /> Saved Listings ({sublets.filter(s => s.isBookmarked).length})
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search location or terms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'activity' ? (
          <HousingActivityTimeline />
        ) : (
          <>
            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-2">Room Layout:</span>
              {roomTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedRoomType(type)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                    selectedRoomType === type
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Sublet Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredSublets.map((item) => (
                <SubletListingCard
                  key={item.id}
                  sublet={item}
                  onBookmark={() => toggleBookmark(item.id)}
                  onInspect={() => setSelectedSubletModal(item)}
                />
              ))}
            </div>

            {filteredSublets.length === 0 && (
              <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800/60">
                <ShieldAlert className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-300">No housing sublets match criteria</h3>
                <p className="text-slate-500 text-sm mt-1">Try updating your filters or search terms.</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal View */}
      {selectedSubletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedSubletModal(null)}
              className="absolute right-5 top-5 text-slate-400 hover:text-white text-xl font-bold"
            >
              ×
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2.5 py-0.5 rounded font-semibold border border-emerald-500/30">
                {selectedSubletModal.roomType}
              </span>
              <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded font-semibold">
                {selectedSubletModal.leaseTerm}
              </span>
            </div>

            <h2 className="text-xl font-bold text-white mb-2">{selectedSubletModal.propertyTitle}</h2>
            <p className="text-slate-400 text-xs leading-relaxed mb-4">{selectedSubletModal.description}</p>

            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-6 text-xs font-mono">
              <div>
                <span className="text-slate-500 block">Monthly Rent</span>
                <span className="text-emerald-400 font-bold text-sm">${selectedSubletModal.monthlyRentUSD}/mo</span>
              </div>
              <div>
                <span className="text-slate-500 block">Security Deposit</span>
                <span className="text-slate-200 font-bold text-sm">${selectedSubletModal.depositUSD}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Utilities Status</span>
                <span className="text-teal-400 font-bold text-sm">{selectedSubletModal.isUtilitiesIncluded ? 'Included in Rent' : 'Billed Separately'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Furnishing</span>
                <span className="text-indigo-400 font-bold text-sm">{selectedSubletModal.isFurnished ? 'Fully Furnished' : 'Unfurnished'}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSelectedSubletModal(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs transition"
              >
                Close
              </button>
              <button
                onClick={() => {
                  toggleBookmark(selectedSubletModal.id);
                  setSelectedSubletModal(null);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/30 transition"
              >
                {selectedSubletModal.isBookmarked ? 'Remove Saved' : 'Save Sublet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
