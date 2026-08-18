import React, { useState } from 'react';
import { ShoppingBag, Search, Filter, PlusCircle, Tag, ShieldCheck, Heart, Sparkles, DollarSign, MessageCircle, Eye, AlertCircle, TrendingUp, CheckCircle, Package } from 'lucide-react';
import ListingCard, { MarketplaceListing } from '../../components/marketplace/ListingCard';
import MarketplaceActivityTimeline from '../../components/marketplace/MarketplaceActivityTimeline';

const SAMPLE_LISTINGS: MarketplaceListing[] = [
  {
    id: 'item-301',
    title: 'Apple MacBook Pro M3 Pro 16" (18GB RAM / 512GB SSD) - Space Black',
    sellerName: 'Jason Reed',
    sellerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    sellerRole: 'CS Senior',
    category: 'Electronics',
    condition: 'Like New',
    price: 1650,
    originalPrice: 2499,
    location: 'North Campus Dorms / Student Center',
    postedDate: '2 hours ago',
    images: ['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800'],
    tags: ['MacBook Pro', 'Apple Silicon', 'Laptops', 'CS Gear'],
    description: 'Flawless condition, battery health 98%. Includes original MagSafe charger, box, and hard shell protective case. Perfect for software engineering & AI workloads.',
    isSaved: true,
    isVerifiedStudent: true,
  },
  {
    id: 'item-302',
    title: 'Organic Chemistry (8th Edition) Hardcover + Solution Manual Set',
    sellerName: 'Maya Lin',
    sellerAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    sellerRole: 'BioChem Junior',
    category: 'Textbooks',
    condition: 'Good',
    price: 45,
    originalPrice: 180,
    location: 'Science Library Lobby',
    postedDate: '5 hours ago',
    images: ['https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800'],
    tags: ['CHEM210', 'Textbooks', 'Pre-Med', 'Study Guide'],
    description: 'No highlighter markings inside. Includes the full worked-out solution manual for problem sets. Required for CHEM210/211 courses.',
    isSaved: false,
    isVerifiedStudent: true,
  },
  {
    id: 'item-303',
    title: 'Herman Miller Aeron Ergonomic Task Chair (Size B - Fully Loaded)',
    sellerName: 'Vikram Sharma',
    sellerAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    sellerRole: 'Grad Student Alumnus',
    category: 'Furniture',
    condition: 'Very Good',
    price: 480,
    originalPrice: 1200,
    location: 'Off-Campus Grad Housing (Pickup Only)',
    postedDate: '1 day ago',
    images: ['https://images.unsplash.com/photo-1580481072645-022f9a6d1270?w=800'],
    tags: ['Ergonomic', 'Dorm Desk', 'Herman Miller', 'Furniture'],
    description: 'PostureFit SL support, fully adjustable arms, lumbar support mesh in perfect tension. Selling due to graduation relocation.',
    isSaved: true,
    isVerifiedStudent: true,
  },
  {
    id: 'item-304',
    title: 'Trek FX 3 Disc Commuter Road Bike + U-Lock & Helmet',
    sellerName: 'Chloe Bennett',
    sellerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    sellerRole: 'Junior Architect',
    category: 'Bicycles & Gear',
    condition: 'Good',
    price: 290,
    originalPrice: 750,
    location: 'East Bike Rack Station',
    postedDate: '1 day ago',
    images: ['https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800'],
    tags: ['Commuter', 'Bicycle', 'Campus Transport', 'Trek'],
    description: 'Lightweight aluminum frame, hydraulic disc brakes, tune-up completed last month. Great for daily commuting between engineering labs and dorms.',
    isSaved: false,
    isVerifiedStudent: true,
  },
];

export default function CampusMarketplacePage() {
  const [listings, setListings] = useState<MarketplaceListing[]>(SAMPLE_LISTINGS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeTab, setActiveTab] = useState<'browse' | 'activity' | 'saved'>('browse');
  const [selectedListingModal, setSelectedListingModal] = useState<MarketplaceListing | null>(null);

  const categories = ['All', 'Electronics', 'Textbooks', 'Furniture', 'Bicycles & Gear', 'Housing Sublets'];

  const toggleSave = (itemId: string) => {
    setListings(prev =>
      prev.map(item => item.id === itemId ? { ...item, isSaved: !item.isSaved } : item)
    );
  };

  const filteredListings = listings.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesTab = activeTab !== 'saved' || item.isSaved;

    return matchesSearch && matchesCat && matchesTab;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header Banner */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-amber-900/60 via-orange-900/40 to-slate-900 border border-amber-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-amber-500/20 text-amber-300 text-xs px-3 py-1 rounded-full font-semibold border border-amber-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Peer-to-Peer Verified Campus Trade
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Student Identity Verified
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-amber-200 bg-clip-text text-transparent">
              Campus Peer Marketplace & Exchange
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Buy, sell, and trade electronics, course textbooks, dorm furniture, and gear safely with verified university peers.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-amber-600/30 transition flex items-center gap-2 border border-amber-400/20 text-sm">
              <PlusCircle className="w-4 h-4" /> Post Item Listing
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto space-y-6">
        {/* Navigation Controls */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('browse')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'browse'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ShoppingBag className="w-4 h-4" /> Browse Marketplace
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'activity'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <TrendingUp className="w-4 h-4" /> Trade Feed
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'saved'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Heart className="w-4 h-4" /> Saved Items ({listings.filter(i => i.isSaved).length})
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search item, textbook, or gear..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-amber-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Dynamic Tab Body */}
        {activeTab === 'activity' ? (
          <MarketplaceActivityTimeline />
        ) : (
          <>
            {/* Category Pills */}
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

            {/* Listing Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  onSave={() => toggleSave(listing.id)}
                  onInspect={() => setSelectedListingModal(listing)}
                />
              ))}
            </div>

            {filteredListings.length === 0 && (
              <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800/60">
                <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-300">No marketplace listings match search</h3>
                <p className="text-slate-500 text-sm mt-1">Try updating your filters or search terms.</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal Popup */}
      {selectedListingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedListingModal(null)}
              className="absolute right-5 top-5 text-slate-400 hover:text-white text-xl font-bold"
            >
              ×
            </button>

            <div className="flex flex-col md:flex-row gap-6">
              <div className="w-full md:w-1/2 h-56 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800">
                <img
                  src={selectedListingModal.images[0]}
                  alt={selectedListingModal.title}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="w-full md:w-1/2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-amber-500/20 text-amber-300 text-xs px-2.5 py-0.5 rounded font-semibold border border-amber-500/30">
                      {selectedListingModal.category}
                    </span>
                    <span className="bg-slate-800 text-slate-300 text-xs px-2.5 py-0.5 rounded font-semibold">
                      {selectedListingModal.condition}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-white mb-2 leading-snug">{selectedListingModal.title}</h2>
                  <div className="text-2xl font-black text-amber-400 mb-3">${selectedListingModal.price}</div>

                  <p className="text-slate-400 text-xs leading-relaxed mb-4">{selectedListingModal.description}</p>
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <div className="flex items-center gap-3 mb-4">
                    <img
                      src={selectedListingModal.sellerAvatar}
                      alt={selectedListingModal.sellerName}
                      className="w-9 h-9 rounded-full border border-slate-700"
                    />
                    <div>
                      <div className="text-xs font-semibold text-slate-200 flex items-center gap-1">
                        {selectedListingModal.sellerName}
                        {selectedListingModal.isVerifiedStudent && <CheckCircle className="w-3.5 h-3.5 text-emerald-400 inline" />}
                      </div>
                      <div className="text-[10px] text-slate-500">{selectedListingModal.sellerRole}</div>
                    </div>
                  </div>

                  <button className="w-full bg-amber-600 hover:bg-amber-500 text-white py-2.5 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 shadow-lg shadow-amber-600/30">
                    <MessageCircle className="w-4 h-4" /> Message Seller
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
