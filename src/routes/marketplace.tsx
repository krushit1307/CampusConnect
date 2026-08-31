import React, { useState } from 'react';
import { SiteShell } from '@/components/site/SiteShell';
import { MarketplaceListingCard } from '@/components/marketplace/MarketplaceListingCard';
import { BiddingModal } from '@/components/marketplace/BiddingModal';
import { CreateListingModal } from '@/components/marketplace/CreateListingModal';
import { MarketplaceListing, ListingCategory } from '@/types/marketplace';
import {
  ShoppingBag,
  Search,
  Plus,
  Filter,
  Gavel,
  ShieldCheck,
  Tag,
  ArrowUpDown,
} from 'lucide-react';

export default function MarketplacePage() {
  const [currentUser] = useState({ id: 'user-self', name: 'Alex Johnson' });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | 'fixed' | 'auction'>('all');
  const [selectedListingForBid, setSelectedListingForBid] = useState<MarketplaceListing | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [listings, setListings] = useState<MarketplaceListing[]>([
    {
      id: 'list-1',
      title: 'Calculus Early Transcendentals 9th Ed (Stewart)',
      description: 'Used for MATH 151/152. Mint condition, no highlighting or missing pages. Includes WebAssign scratch-off code!',
      category: 'textbooks',
      condition: 'like_new',
      type: 'auction',
      price: 45,
      currentBid: 65,
      bids: [
        { id: 'b1', listingId: 'list-1', bidderId: 'u2', bidderName: 'Marcus T.', amount: 50, createdAt: '2026-08-24T10:00:00Z' },
        { id: 'b2', listingId: 'list-1', bidderId: 'u3', bidderName: 'Elena R.', amount: 65, createdAt: '2026-08-24T14:30:00Z' },
      ],
      auctionEndsAt: '2026-08-28T18:00:00Z',
      images: ['https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=60'],
      sellerId: 'seller-1',
      sellerName: 'David Kim',
      location: 'Engineering Quad',
      status: 'active',
      createdAt: '2026-08-24T09:00:00Z',
      escrowProtected: true,
    },
    {
      id: 'list-2',
      title: 'TI-84 Plus CE Graphing Calculator (Rose Gold)',
      description: 'Fully charged with USB cable. Essential for AP stats, physics, and calculus exams.',
      category: 'electronics',
      condition: 'good',
      type: 'fixed',
      price: 70,
      bids: [],
      images: ['https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?w=600&auto=format&fit=crop&q=60'],
      sellerId: 'seller-2',
      sellerName: 'Sarah Jenkins',
      location: 'Main Library',
      status: 'active',
      createdAt: '2026-08-23T11:00:00Z',
      escrowProtected: true,
    },
    {
      id: 'list-3',
      title: 'Spring Semester Sublet (Private Room in 3B2B)',
      description: '5 min walk to campus! Utilities and high-speed Wi-Fi included. Furnished with desk, bed, and wardrobe.',
      category: 'sublets',
      condition: 'good',
      type: 'fixed',
      price: 650,
      bids: [],
      images: ['https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=600&auto=format&fit=crop&q=60'],
      sellerId: 'seller-3',
      sellerName: 'Jordan Lee',
      location: 'College Ave Apartments',
      status: 'active',
      createdAt: '2026-08-22T15:00:00Z',
      escrowProtected: true,
    },
    {
      id: 'list-4',
      title: 'Logitech MX Master 3S Wireless Mouse',
      description: 'Ergonomic mouse in pale grey. Super quiet clicks and electromagnetic scroll wheel. Barely used.',
      category: 'electronics',
      condition: 'like_new',
      type: 'auction',
      price: 40,
      currentBid: 55,
      bids: [
        { id: 'b3', listingId: 'list-4', bidderId: 'u4', bidderName: 'Priya N.', amount: 45, createdAt: '2026-08-24T12:00:00Z' },
        { id: 'b4', listingId: 'list-4', bidderId: 'u5', bidderName: 'Sam W.', amount: 55, createdAt: '2026-08-24T16:00:00Z' },
      ],
      images: ['https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=600&auto=format&fit=crop&q=60'],
      sellerId: 'seller-4',
      sellerName: 'Lucas Vance',
      location: 'Student Center',
      status: 'active',
      createdAt: '2026-08-24T08:00:00Z',
      escrowProtected: false,
    },
  ]);

  const handlePlaceBid = (listingId: string, amount: number) => {
    setListings((prev) =>
      prev.map((item) => {
        if (item.id === listingId) {
          const newBid = {
            id: `bid-${Date.now()}`,
            listingId,
            bidderId: currentUser.id,
            bidderName: currentUser.name,
            amount,
            createdAt: new Date().toISOString(),
          };
          return {
            ...item,
            currentBid: amount,
            bids: [newBid, ...item.bids],
          };
        }
        return item;
      })
    );
  };

  const handleCreateListing = (newListingData: any) => {
    const created: MarketplaceListing = {
      ...newListingData,
      id: `list-${Date.now()}`,
      createdAt: new Date().toISOString(),
      bids: [],
      status: 'active',
    };
    setListings([created, ...listings]);
  };

  const filteredListings = listings.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesType = filterType === 'all' || item.type === filterType;

    return matchesSearch && matchesCategory && matchesType;
  });

  return (
    <SiteShell>
      <div className="min-h-screen bg-[#faf8f5] py-8 px-4 md:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-black pb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-lime border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <ShoppingBag size={24} />
                </span>
                <h1 className="text-3xl md:text-4xl font-display font-black tracking-tight text-black">
                  Campus Marketplace
                </h1>
              </div>
              <p className="font-mono text-sm text-gray-600 mt-1">
                Verified peer-to-peer student marketplace with escrow-protected bidding & direct buys.
              </p>
            </div>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="neu-border bg-lime hover:bg-lime/90 px-5 py-3 font-mono text-sm font-black uppercase text-black flex items-center gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-transform"
            >
              <Plus size={18} /> Post a Listing
            </button>
          </div>

          {/* Search & Filters Toolbar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search Input */}
            <div className="md:col-span-2 relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                <Search size={18} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search textbooks, housing, electronics, notes..."
                className="w-full pl-10 pr-4 py-2.5 border-2 border-black rounded font-mono text-sm bg-white outline-hidden focus:ring-2 focus:ring-lime"
              />
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2.5 border-2 border-black rounded font-mono text-xs bg-white uppercase font-bold"
              >
                <option value="all">All Categories</option>
                <option value="textbooks">Textbooks</option>
                <option value="electronics">Electronics</option>
                <option value="sublets">Housing & Sublets</option>
                <option value="furniture">Furniture</option>
                <option value="supplies">School Supplies</option>
                <option value="services">Tutoring & Services</option>
              </select>
            </div>

            {/* Format Filter */}
            <div className="flex gap-1 bg-white p-1 border-2 border-black rounded">
              <button
                onClick={() => setFilterType('all')}
                className={`flex-1 py-1.5 font-mono text-xs font-bold rounded uppercase ${
                  filterType === 'all' ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('fixed')}
                className={`flex-1 py-1.5 font-mono text-xs font-bold rounded uppercase ${
                  filterType === 'fixed' ? 'bg-lime text-black' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Buy Now
              </button>
              <button
                onClick={() => setFilterType('auction')}
                className={`flex-1 py-1.5 font-mono text-xs font-bold rounded uppercase ${
                  filterType === 'auction' ? 'bg-amber-300 text-black' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Auctions
              </button>
            </div>
          </div>

          {/* Listings Grid */}
          {filteredListings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredListings.map((listing) => (
                <MarketplaceListingCard
                  key={listing.id}
                  listing={listing}
                  onBidClick={(item) => setSelectedListingForBid(item)}
                  onBuyClick={(item) => alert(`Proceed to Escrow Checkout for "${item.title}" ($${item.price})`)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white border-2 border-black rounded-lg p-8">
              <p className="font-display font-black text-xl text-black">No listings found</p>
              <p className="font-mono text-xs text-gray-500 mt-1">Try tweaking your search keywords or active filters.</p>
            </div>
          )}
        </div>
      </div>

      {/* Bidding Modal */}
      {selectedListingForBid && (
        <BiddingModal
          listing={selectedListingForBid}
          isOpen={!!selectedListingForBid}
          onClose={() => setSelectedListingForBid(null)}
          onPlaceBid={handlePlaceBid}
          currentUser={currentUser}
        />
      )}

      {/* Create Listing Modal */}
      <CreateListingModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateListing={handleCreateListing}
        currentUser={currentUser}
      />
    </SiteShell>
  );
}
