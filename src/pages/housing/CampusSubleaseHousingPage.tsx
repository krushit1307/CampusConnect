import React, { useState } from 'react';
import {
  CampusHousingServiceHandler,
} from '../../backend/src/services/CampusHousingService';
import {
  HousingListing,
  HousingInquiry,
  HousingFilterOptions,
} from '../../backend/src/models/CampusHousingModel';
import { HousingListingCard } from '../../src/components/housing/HousingListingCard';
import { HousingActivityTimeline } from '../../src/components/housing/HousingActivityTimeline';
import {
  Home,
  Search,
  Filter,
  PlusCircle,
  Sparkles,
  CheckCircle2,
  X,
  Mail,
  Calendar,
  Building,
} from 'lucide-react';

export const CampusSubleaseHousingPage: React.FC = () => {
  const [listings, setListings] = useState<HousingListing[]>(() =>
    CampusHousingServiceHandler.fetchHousingListings()
  );
  const [inquiries, setInquiries] = useState<HousingInquiry[]>(() =>
    CampusHousingServiceHandler.fetchUserInquiries()
  );

  const [filters, setFilters] = useState<HousingFilterOptions>({
    propertyType: 'All',
    maxRent: 1500,
    leaseTerm: 'All',
    searchQuery: '',
  });

  const [selectedHouse, setSelectedHouse] = useState<HousingListing | null>(null);
  const [applicantName, setApplicantName] = useState<string>('Alex Mercer');
  const [applicantEmail, setApplicantEmail] = useState<string>('alex.mercer@campus.edu');
  const [moveInDate, setMoveInDate] = useState<string>('June 1, 2026');
  const [inquiryMessage, setInquiryMessage] = useState<string>('');
  const [isInquireSuccess, setIsInquireSuccess] = useState<boolean>(false);

  // New Listing State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newPropertyType, setNewPropertyType] = useState<'apartment' | 'studio' | 'shared-room' | 'house'>('apartment');
  const [newMonthlyRent, setNewMonthlyRent] = useState<number>(800);
  const [newDistance, setNewDistance] = useState<string>('5 min walk');
  const [newAddress, setNewAddress] = useState<string>('');
  const [newLeaseTerm, setNewLeaseTerm] = useState<'Summer 2026' | 'Fall 2026' | 'Full Year' | 'Spring 2026'>('Summer 2026');
  const [newAmenities, setNewAmenities] = useState<string>('Furnished, High-speed Wi-Fi, Laundry');
  const [newDescription, setNewDescription] = useState<string>('');

  const applyFilterChanges = (updatedFilters: Partial<HousingFilterOptions>) => {
    const nextFilters = { ...filters, ...updatedFilters };
    setFilters(nextFilters);
    setListings(CampusHousingServiceHandler.fetchHousingListings(nextFilters));
  };

  const handleInquirySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHouse) return;

    CampusHousingServiceHandler.submitSubleaseInquiry(
      selectedHouse.id,
      applicantName,
      applicantEmail,
      moveInDate,
      inquiryMessage
    );

    setInquiries(CampusHousingServiceHandler.fetchUserInquiries());
    setIsInquireSuccess(true);
    setTimeout(() => {
      setIsInquireSuccess(false);
      setSelectedHouse(null);
    }, 1800);
  };

  const handleDecision = (inquiryId: string, status: 'accepted' | 'declined') => {
    CampusHousingServiceHandler.updateInquiryDecision(inquiryId, status);
    setInquiries(CampusHousingServiceHandler.fetchUserInquiries());
  };

  const handleCreateListingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    CampusHousingServiceHandler.createNewHousingListing({
      title: newTitle,
      propertyType: newPropertyType,
      monthlyRent: newMonthlyRent,
      bedrooms: 2,
      bathrooms: 1,
      distanceToCampus: newDistance,
      address: newAddress,
      leaseTerm: newLeaseTerm,
      listerName: "Alex Mercer",
      listerAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      listerRole: "Junior Student",
      isVerifiedStudent: true,
      amenities: newAmenities.split(',').map((a) => a.trim()),
      description: newDescription,
      images: ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&auto=format&fit=crop&q=80"],
    });

    setListings(CampusHousingServiceHandler.fetchHousingListings(filters));
    setShowCreateModal(false);
    setNewTitle('');
    setNewAddress('');
    setNewDescription('');
  };

  return (
    <div className="min-h-screen bg-gray-50/50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Hero Banner */}
        <div className="bg-gradient-to-r from-blue-950 via-indigo-900 to-purple-950 rounded-3xl p-8 sm:p-10 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 backdrop-blur-md border border-indigo-400/30 px-3.5 py-1.5 rounded-full text-xs font-semibold text-indigo-200">
              <Sparkles className="w-4 h-4 text-indigo-300" />
              Verified Student Housing & Sublease Exchange
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
              Off-Campus Sublease & Roommate Finder
            </h1>
            <p className="text-indigo-200 text-base sm:text-lg leading-relaxed">
              Browse student-verified summer subleases, semester studio apartments, and shared rooms near campus. Directly message verified student listers.
            </p>
            <div className="pt-2 flex flex-wrap gap-4 items-center">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-white text-indigo-950 font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-indigo-50 transition-all flex items-center gap-2 text-sm"
              >
                <PlusCircle className="w-5 h-5 text-indigo-600" />
                Post Sublease Listing
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
                placeholder="Search by street address, distance to campus, amenities, or title..."
                value={filters.searchQuery}
                onChange={(e) => applyFilterChanges({ searchQuery: e.target.value })}
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm text-gray-900"
              />
            </div>

            {/* Property Type Dropdown */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filters.propertyType}
                onChange={(e) => applyFilterChanges({ propertyType: e.target.value })}
                className="w-full md:w-auto px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-800 font-medium bg-white"
              >
                <option value="All">All Types</option>
                <option value="apartment">2-3BR Apartment</option>
                <option value="studio">Studio</option>
                <option value="shared-room">Shared House Room</option>
              </select>

              {/* Lease Term Dropdown */}
              <select
                value={filters.leaseTerm}
                onChange={(e) => applyFilterChanges({ leaseTerm: e.target.value })}
                className="w-full md:w-auto px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-800 font-medium bg-white"
              >
                <option value="All">All Lease Terms</option>
                <option value="Summer 2026">Summer 2026</option>
                <option value="Fall 2026">Fall 2026</option>
                <option value="Full Year">Full Year</option>
              </select>
            </div>
          </div>
        </div>

        {/* Listings Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-xl text-gray-900 flex items-center gap-2">
              <Home className="w-6 h-6 text-indigo-600" />
              Available Housing & Subleases ({listings.length})
            </h2>
          </div>

          {listings.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
              <Building className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-gray-800 font-semibold text-lg">No housing listings found</h3>
              <p className="text-gray-500 text-sm mt-1">Try broadening your search or lease term filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map((house) => (
                <HousingListingCard
                  key={house.id}
                  listing={house}
                  onInquireClick={(h) => setSelectedHouse(h)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Inquiries Timeline */}
        <HousingActivityTimeline
          inquiries={inquiries}
          onDecision={handleDecision}
        />

        {/* Inquiry Modal */}
        {selectedHouse && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative animate-in fade-in zoom-in duration-200">
              <button
                onClick={() => setSelectedHouse(null)}
                className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>

              {isInquireSuccess ? (
                <div className="text-center py-8 space-y-3">
                  <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
                  <h3 className="text-2xl font-bold text-gray-900">Inquiry Sent!</h3>
                  <p className="text-sm text-gray-600">
                    Your sublease inquiry for "{selectedHouse.title}" has been delivered to {selectedHouse.listerName}.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleInquirySubmit} className="space-y-5">
                  <div>
                    <h3 className="font-bold text-gray-900 text-xl">{selectedHouse.title}</h3>
                    <p className="text-xs text-indigo-600 font-semibold mt-1">
                      Lister: {selectedHouse.listerName} (${selectedHouse.monthlyRent}/mo)
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Your Full Name</label>
                      <input
                        type="text"
                        required
                        value={applicantName}
                        onChange={(e) => setApplicantName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Campus Email</label>
                      <input
                        type="email"
                        required
                        value={applicantEmail}
                        onChange={(e) => setApplicantEmail(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Target Move-in Date</label>
                      <input
                        type="text"
                        required
                        value={moveInDate}
                        onChange={(e) => setMoveInDate(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Message to Student Lister</label>
                      <textarea
                        rows={3}
                        required
                        placeholder="Introduce yourself, your major, and any questions about utilities or parking..."
                        value={inquiryMessage}
                        onChange={(e) => setInquiryMessage(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors text-sm"
                  >
                    Send Sublease Inquiry
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
                <h3 className="text-2xl font-bold text-gray-900">List Your Sublease</h3>
                <p className="text-xs text-gray-500 mt-1">Post your off-campus apartment or room for student sublease.</p>
              </div>

              <form onSubmit={handleCreateListingSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Modern 2BR Sublease near North Campus"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Property Type</label>
                    <select
                      value={newPropertyType}
                      onChange={(e) => setNewPropertyType(e.target.value as any)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                    >
                      <option value="apartment">2-3BR Apartment</option>
                      <option value="studio">Studio</option>
                      <option value="shared-room">Shared House Room</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Monthly Rent ($)</label>
                    <input
                      type="number"
                      required
                      min={200}
                      max={3000}
                      value={newMonthlyRent}
                      onChange={(e) => setNewMonthlyRent(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Lease Term</label>
                    <select
                      value={newLeaseTerm}
                      onChange={(e) => setNewLeaseTerm(e.target.value as any)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                    >
                      <option value="Summer 2026">Summer 2026</option>
                      <option value="Fall 2026">Fall 2026</option>
                      <option value="Full Year">Full Year</option>
                      <option value="Spring 2026">Spring 2026</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Distance to Campus</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 5 min walk"
                      value={newDistance}
                      onChange={(e) => setNewDistance(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Street Address</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 412 College Ave, Apt 3B"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Amenities (comma separated)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Furnished, Wi-Fi, In-unit Laundry"
                    value={newAmenities}
                    onChange={(e) => setNewAmenities(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Property Description</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Provide details on furniture, roommate preferences, or utility costs..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors text-sm"
                >
                  Publish Housing Sublease
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
