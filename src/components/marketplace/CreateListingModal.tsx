import React, { useState } from 'react';
import { MarketplaceListing, ListingCategory, ListingCondition, ListingType } from '@/types/marketplace';
import { X, Plus, Image as ImageIcon, DollarSign, Gavel } from 'lucide-react';

interface CreateListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateListing: (listing: Omit<MarketplaceListing, 'id' | 'createdAt' | 'bids' | 'status'>) => void;
  currentUser: { id: string; name: string };
}

export function CreateListingModal({
  isOpen,
  onClose,
  onCreateListing,
  currentUser,
}: CreateListingModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ListingCategory>('textbooks');
  const [condition, setCondition] = useState<ListingCondition>('good');
  const [type, setType] = useState<ListingType>('fixed');
  const [price, setPrice] = useState<number>(20);
  const [location, setLocation] = useState('Campus Library / Student Union');
  const [imageUrl, setImageUrl] = useState('');
  const [escrowProtected, setEscrowProtected] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || price <= 0) return;

    onCreateListing({
      title: title.trim(),
      description: description.trim(),
      category,
      condition,
      type,
      price,
      currentBid: type === 'auction' ? price : undefined,
      images: imageUrl ? [imageUrl] : [],
      sellerId: currentUser.id,
      sellerName: currentUser.name,
      location,
      escrowProtected,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white border-4 border-black rounded-lg max-w-lg w-full p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 border-2 border-black rounded hover:bg-gray-100"
        >
          <X size={18} />
        </button>

        <h2 className="text-2xl font-display font-black text-black mb-1">
          Create Item Listing
        </h2>
        <p className="text-xs font-mono text-gray-600 mb-4">
          List student textbooks, supplies, housing, or electronics.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Listing Format Switch */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType('fixed')}
              className={`p-3 border-2 border-black rounded flex flex-col items-center gap-1 font-mono text-xs font-bold transition-all ${
                type === 'fixed' ? 'bg-lime text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-slate-50 text-gray-600'
              }`}
            >
              <DollarSign size={18} /> Fixed Price (Buy Now)
            </button>
            <button
              type="button"
              onClick={() => setType('auction')}
              className={`p-3 border-2 border-black rounded flex flex-col items-center gap-1 font-mono text-xs font-bold transition-all ${
                type === 'auction' ? 'bg-amber-300 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-slate-50 text-gray-600'
              }`}
            >
              <Gavel size={18} /> Live Campus Auction
            </button>
          </div>

          <div>
            <label className="block font-mono text-xs font-bold uppercase mb-1">Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Organic Chemistry 8th Ed + Study Guide"
              className="w-full px-3 py-2 border-2 border-black rounded font-mono text-sm bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-xs font-bold uppercase mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ListingCategory)}
                className="w-full px-3 py-2 border-2 border-black rounded font-mono text-xs bg-white"
              >
                <option value="textbooks">Textbooks</option>
                <option value="electronics">Electronics</option>
                <option value="sublets">Housing & Sublets</option>
                <option value="furniture">Furniture</option>
                <option value="supplies">School Supplies</option>
                <option value="services">Tutoring & Services</option>
              </select>
            </div>

            <div>
              <label className="block font-mono text-xs font-bold uppercase mb-1">Condition</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as ListingCondition)}
                className="w-full px-3 py-2 border-2 border-black rounded font-mono text-xs bg-white"
              >
                <option value="new">Brand New</option>
                <option value="like_new">Like New</option>
                <option value="good">Good Condition</option>
                <option value="fair">Fair</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-xs font-bold uppercase mb-1">
                {type === 'auction' ? 'Starting Bid ($)' : 'Price ($ USD)'}
              </label>
              <input
                type="number"
                required
                min="1"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full px-3 py-2 border-2 border-black rounded font-mono text-sm bg-white"
              />
            </div>
            <div>
              <label className="block font-mono text-xs font-bold uppercase mb-1">Pickup Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. North Quad / Dorms"
                className="w-full px-3 py-2 border-2 border-black rounded font-mono text-sm bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-xs font-bold uppercase mb-1">Image URL</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <ImageIcon size={16} />
              </span>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full pl-9 pr-3 py-2 border-2 border-black rounded font-mono text-sm bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-xs font-bold uppercase mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Include details about syllabus version, highlighting, included accessories, or meetup times..."
              className="w-full px-3 py-2 border-2 border-black rounded font-mono text-sm bg-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="escrow"
              checked={escrowProtected}
              onChange={(e) => setEscrowProtected(e.target.checked)}
              className="w-4 h-4 rounded border-2 border-black accent-lime"
            />
            <label htmlFor="escrow" className="font-mono text-xs font-bold text-gray-700 cursor-pointer">
              Enable Campus Escrow protection for this sale
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border-2 border-black rounded font-mono text-xs font-bold uppercase hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-lime hover:bg-lime/90 border-2 border-black rounded font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              Publish Listing
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
