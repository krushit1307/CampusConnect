import React, { useState } from 'react';
import {
  CampusTextbookServiceHandler,
} from '../../backend/src/services/CampusTextbookService';
import {
  TextbookListing,
  TextbookOffer,
  TextbookFilterOptions,
} from '../../backend/src/models/CampusTextbookModel';
import { TextbookListingCard } from '../../src/components/textbooks/TextbookListingCard';
import { TextbookActivityTimeline } from '../../src/components/textbooks/TextbookActivityTimeline';
import {
  BookOpen,
  Search,
  Filter,
  PlusCircle,
  Sparkles,
  CheckCircle2,
  DollarSign,
  X,
  FileText,
} from 'lucide-react';

export const CampusTextbookExchangePage: React.FC = () => {
  const [listings, setListings] = useState<TextbookListing[]>(() =>
    CampusTextbookServiceHandler.fetchTextbookListings()
  );
  const [offers, setOffers] = useState<TextbookOffer[]>(() =>
    CampusTextbookServiceHandler.fetchUserOffers()
  );

  const [filters, setFilters] = useState<TextbookFilterOptions>({
    department: 'All',
    condition: 'All',
    maxPrice: 100,
    includesNotesOnly: false,
    searchQuery: '',
  });

  const [selectedBook, setSelectedBook] = useState<TextbookListing | null>(null);
  const [offeredPrice, setOfferedPrice] = useState<number>(0);
  const [offerMessage, setOfferMessage] = useState<string>('');
  const [buyerName, setBuyerName] = useState<string>('Alex Mercer');
  const [isOfferSuccess, setIsOfferSuccess] = useState<boolean>(false);

  // New Listing State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newIsbn, setNewIsbn] = useState<string>('');
  const [newAuthor, setNewAuthor] = useState<string>('');
  const [newEdition, setNewEdition] = useState<string>('1st Edition');
  const [newCourseCode, setNewCourseCode] = useState<string>('');
  const [newCondition, setNewCondition] = useState<'like-new' | 'good' | 'fair' | 'annotated'>('like-new');
  const [newPrice, setNewPrice] = useState<number>(30);
  const [newDepartment, setNewDepartment] = useState<string>('Computer Science');
  const [newDescription, setNewDescription] = useState<string>('');
  const [newIncludesNotes, setNewIncludesNotes] = useState<boolean>(false);

  const applyFilterChanges = (updatedFilters: Partial<TextbookFilterOptions>) => {
    const nextFilters = { ...filters, ...updatedFilters };
    setFilters(nextFilters);
    setListings(CampusTextbookServiceHandler.fetchTextbookListings(nextFilters));
  };

  const handleMakeOfferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBook) return;

    CampusTextbookServiceHandler.submitPurchaseOffer(
      selectedBook.id,
      buyerName,
      offeredPrice,
      offerMessage
    );

    setOffers(CampusTextbookServiceHandler.fetchUserOffers());
    setIsOfferSuccess(true);
    setTimeout(() => {
      setIsOfferSuccess(false);
      setSelectedBook(null);
    }, 1800);
  };

  const handleOfferDecision = (offerId: string, status: 'accepted' | 'declined') => {
    CampusTextbookServiceHandler.updateOfferDecision(offerId, status);
    setOffers(CampusTextbookServiceHandler.fetchUserOffers());
    setListings(CampusTextbookServiceHandler.fetchTextbookListings(filters));
  };

  const handleCreateListingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    CampusTextbookServiceHandler.createNewListing({
      title: newTitle,
      isbn: newIsbn,
      author: newAuthor,
      edition: newEdition,
      courseCode: newCourseCode,
      condition: newCondition,
      price: newPrice,
      sellerName: "Alex Mercer",
      sellerAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      department: newDepartment,
      description: newDescription,
      includesNotes: newIncludesNotes,
    });

    setListings(CampusTextbookServiceHandler.fetchTextbookListings(filters));
    setShowCreateModal(false);
    setNewTitle('');
    setNewIsbn('');
    setNewAuthor('');
    setNewCourseCode('');
    setNewDescription('');
  };

  return (
    <div className="min-h-screen bg-gray-50/50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Hero Section */}
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-indigo-950 rounded-3xl p-8 sm:p-10 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 bg-purple-500/20 backdrop-blur-md border border-purple-400/30 px-3.5 py-1.5 rounded-full text-xs font-semibold text-purple-200">
              <Sparkles className="w-4 h-4 text-purple-300" />
              Peer-to-Peer Academic Exchange
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
              Campus Peer Textbook & Solution Manual Exchange
            </h1>
            <p className="text-purple-200 text-base sm:text-lg leading-relaxed">
              Buy, sell, and trade course textbooks directly with students on your campus. Save up to 80% on expensive course materials with peer-annotated copies.
            </p>
            <div className="pt-2 flex flex-wrap gap-4 items-center">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-white text-indigo-950 font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-purple-50 transition-all flex items-center gap-2 text-sm"
              >
                <PlusCircle className="w-5 h-5 text-purple-600" />
                List Your Textbook
              </button>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by book title, ISBN, author, or course code..."
                value={filters.searchQuery}
                onChange={(e) => applyFilterChanges({ searchQuery: e.target.value })}
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 text-sm text-gray-900"
              />
            </div>

            {/* Department Dropdown */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filters.department}
                onChange={(e) => applyFilterChanges({ department: e.target.value })}
                className="w-full md:w-auto px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm text-gray-800 font-medium bg-white"
              >
                <option value="All">All Departments</option>
                <option value="Computer Science">Computer Science</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Physics">Physics</option>
              </select>

              {/* Condition Dropdown */}
              <select
                value={filters.condition}
                onChange={(e) => applyFilterChanges({ condition: e.target.value })}
                className="w-full md:w-auto px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm text-gray-800 font-medium bg-white"
              >
                <option value="All">All Conditions</option>
                <option value="like-new">Like New</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
              </select>
            </div>
          </div>
        </div>

        {/* Listings Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-xl text-gray-900 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-purple-600" />
              Active Textbook Listings ({listings.length})
            </h2>
          </div>

          {listings.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-gray-800 font-semibold text-lg">No textbook listings found</h3>
              <p className="text-gray-500 text-sm mt-1">Try broadening your search or department filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {listings.map((book) => (
                <TextbookListingCard
                  key={book.id}
                  book={book}
                  onMakeOfferClick={(b) => {
                    setSelectedBook(b);
                    setOfferedPrice(b.price);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Offers Timeline */}
        <TextbookActivityTimeline
          offers={offers}
          onDecision={handleOfferDecision}
        />

        {/* Make Offer Modal */}
        {selectedBook && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative animate-in fade-in zoom-in duration-200">
              <button
                onClick={() => setSelectedBook(null)}
                className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>

              {isOfferSuccess ? (
                <div className="text-center py-8 space-y-3">
                  <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
                  <h3 className="text-2xl font-bold text-gray-900">Offer Submitted!</h3>
                  <p className="text-sm text-gray-600">
                    Your offer of ${offeredPrice} for "{selectedBook.title}" has been sent to {selectedBook.sellerName}.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleMakeOfferSubmit} className="space-y-5">
                  <div>
                    <h3 className="font-bold text-gray-900 text-xl">{selectedBook.title}</h3>
                    <p className="text-xs text-purple-600 font-semibold mt-1">
                      Listed by {selectedBook.sellerName} for ${selectedBook.price}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Your Name</label>
                      <input
                        type="text"
                        required
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Offered Price ($)</label>
                      <input
                        type="number"
                        required
                        min={1}
                        max={500}
                        value={offeredPrice}
                        onChange={(e) => setOfferedPrice(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Message to Seller</label>
                      <textarea
                        rows={3}
                        required
                        placeholder="State your pickup availability or questions about book annotations..."
                        value={offerMessage}
                        onChange={(e) => setOfferMessage(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors text-sm"
                  >
                    Submit Price Offer
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Create Listing Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative">
              <button
                onClick={() => setShowCreateModal(false)}
                className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900">List Your Textbook</h3>
                <p className="text-xs text-gray-500 mt-1">Post a textbook for peer exchange or resale.</p>
              </div>

              <form onSubmit={handleCreateListingSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Book Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Artificial Intelligence: A Modern Approach"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">ISBN Number</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 978-0134610993"
                      value={newIsbn}
                      onChange={(e) => setNewIsbn(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Course Code</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CS 301"
                      value={newCourseCode}
                      onChange={(e) => setNewCourseCode(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Author(s)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Stuart Russell"
                      value={newAuthor}
                      onChange={(e) => setNewAuthor(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Edition</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 4th Edition"
                      value={newEdition}
                      onChange={(e) => setNewEdition(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Condition</label>
                    <select
                      value={newCondition}
                      onChange={(e) => setNewCondition(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 bg-white"
                    >
                      <option value="like-new">Like New</option>
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="annotated">Annotated</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Price ($)</label>
                    <input
                      type="number"
                      min={1}
                      max={300}
                      value={newPrice}
                      onChange={(e) => setNewPrice(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Description & Annotations</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Provide details on book condition, highlighting, or solution guides..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="includesNotes"
                    checked={newIncludesNotes}
                    onChange={(e) => setNewIncludesNotes(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <label htmlFor="includesNotes" className="text-xs font-medium text-gray-700">
                    Includes personal class notes / solution manuals
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors text-sm"
                >
                  Publish Textbook Listing
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
