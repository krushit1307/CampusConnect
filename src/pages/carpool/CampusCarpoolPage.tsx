import React, { useState } from 'react';
import { Car, Navigation, MapPin, Calendar, Clock, DollarSign, Users, PlusCircle, Search, Filter, Sparkles, ShieldCheck, CheckCircle2, UserPlus, Activity, Flame, ShieldAlert } from 'lucide-react';
import CarpoolRideCard, { CarpoolRide } from '../../components/carpool/CarpoolRideCard';
import CarpoolActivityTimeline from '../../components/carpool/CarpoolActivityTimeline';

const INITIAL_RIDES: CarpoolRide[] = [
  {
    id: 'ride-701',
    originLocation: 'North Campus Student Housing',
    destinationLocation: 'Metropolitan International Airport (JFK/LGA)',
    departureTime: 'Friday, Oct 24 @ 3:30 PM',
    driverName: 'Marcus Vance',
    driverAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    seatsAvailable: 3,
    totalSeats: 4,
    pricePerSeatUSD: 18,
    carModel: '2023 Tesla Model 3 (White)',
    tags: ['Airport Run', 'Luggage Space', 'Non-Smoking', 'Music Allowed'],
    description: 'Heading to the airport for Fall break! Leaving promptly at 3:30 PM. Plenty of trunk space for 2 large suitcases per passenger.',
    isBooked: false,
    rideType: 'Weekend Trip',
  },
  {
    id: 'ride-702',
    originLocation: 'Downtown University Heights',
    destinationLocation: 'Engineering Quad / Science Library',
    departureTime: 'Mon - Thu @ 8:15 AM Daily',
    driverName: 'Elena Rostova',
    driverAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    seatsAvailable: 2,
    totalSeats: 4,
    pricePerSeatUSD: 5,
    carModel: '2022 Honda Civic EX (Blue)',
    tags: ['Daily Commute', 'Morning Classes', 'EV Parking Pass'],
    description: 'Daily morning commute group for students living downtown. Drop off right in front of the main library plaza.',
    isBookmarked: true,
    isBooked: true,
    rideType: 'Daily Commute',
  },
  {
    id: 'ride-703',
    originLocation: 'Campus West Dormitories',
    destinationLocation: 'Trader Joe\'s & Target Commercial Center',
    departureTime: 'Saturday @ 11:00 AM',
    driverName: 'David Chen',
    driverAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    seatsAvailable: 3,
    totalSeats: 4,
    pricePerSeatUSD: 4,
    carModel: '2021 Toyota RAV4 Hybrid (Silver)',
    tags: ['Grocery Run', 'Short Trip', 'Spacious Trunk'],
    description: 'Weekly grocery run trip! We will spend about 1 hour shopping at Target/Trader Joe\'s before heading back to West campus.',
    isBooked: false,
    rideType: 'Grocery Run',
  },
];

export default function CampusCarpoolPage() {
  const [rides, setRides] = useState<CarpoolRide[]>(INITIAL_RIDES);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRideType, setSelectedRideType] = useState('All');
  const [activeTab, setActiveTab] = useState<'discover' | 'activity' | 'my-rides'>('discover');
  const [selectedRideModal, setSelectedRideModal] = useState<CarpoolRide | null>(null);

  const rideTypes = ['All', 'Daily Commute', 'Weekend Trip', 'Grocery Run'];

  const toggleBookSeat = (id: string) => {
    setRides(prev =>
      prev.map(ride => {
        if (ride.id === id) {
          const nextBooked = !ride.isBooked;
          return {
            ...ride,
            isBooked: nextBooked,
            seatsAvailable: nextBooked ? ride.seatsAvailable - 1 : ride.seatsAvailable + 1,
          };
        }
        return ride;
      })
    );
  };

  const filteredRides = rides.filter(ride => {
    const matchesSearch = ride.destinationLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          ride.originLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          ride.driverName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedRideType === 'All' || ride.rideType === selectedRideType;
    const matchesTab = activeTab !== 'my-rides' || ride.isBooked;

    return matchesSearch && matchesType && matchesTab;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header Banner */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-blue-950 via-cyan-950 to-slate-900 border border-cyan-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-cyan-500/20 text-cyan-300 text-xs px-3 py-1 rounded-full font-semibold border border-cyan-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> CampusConnect RideShare
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-400" /> Eco-Friendly Student Commutes
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-cyan-200 bg-clip-text text-transparent">
              Campus Peer Carpool & Ride Exchange
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Share rides with fellow verified students for daily commutes, grocery runs, and weekend airport trips while splitting gas costs.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-cyan-600/30 transition flex items-center gap-2 border border-cyan-400/20 text-sm">
              <PlusCircle className="w-4 h-4" /> Offer a Carpool Ride
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
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Car className="w-4 h-4" /> Available Rides
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'activity'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Activity className="w-4 h-4" /> Carpool Stream
            </button>
            <button
              onClick={() => setActiveTab('my-rides')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'my-rides'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" /> Reserved Seats ({rides.filter(r => r.isBooked).length})
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search destination or driver..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-cyan-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Tab Body */}
        {activeTab === 'activity' ? (
          <CarpoolActivityTimeline />
        ) : (
          <>
            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-2">Category:</span>
              {rideTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedRideType(type)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                    selectedRideType === type
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Ride Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredRides.map((ride) => (
                <CarpoolRideCard
                  key={ride.id}
                  ride={ride}
                  onBook={() => toggleBookSeat(ride.id)}
                  onInspect={() => setSelectedRideModal(ride)}
                />
              ))}
            </div>

            {filteredRides.length === 0 && (
              <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800/60">
                <ShieldAlert className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-300">No carpool rides match criteria</h3>
                <p className="text-slate-500 text-sm mt-1">Try updating your filters or search keywords.</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal View Component */}
      {selectedRideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedRideModal(null)}
              className="absolute right-5 top-5 text-slate-400 hover:text-white text-xl font-bold"
            >
              ×
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="bg-cyan-500/20 text-cyan-400 text-xs px-2.5 py-0.5 rounded font-mono font-semibold border border-cyan-500/30">
                {selectedRideModal.rideType}
              </span>
              <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded font-semibold">
                {selectedRideModal.carModel}
              </span>
            </div>

            <h2 className="text-xl font-bold text-white mb-2">Ride to {selectedRideModal.destinationLocation}</h2>
            <p className="text-slate-400 text-xs leading-relaxed mb-4">{selectedRideModal.description}</p>

            <div className="space-y-2 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-6 text-xs font-mono">
              <div className="flex items-center gap-2 text-slate-300">
                <Navigation className="w-4 h-4 text-cyan-400" />
                <span>Pickup: {selectedRideModal.originLocation}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <MapPin className="w-4 h-4 text-rose-400" />
                <span>Dropoff: {selectedRideModal.destinationLocation}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Time: {selectedRideModal.departureTime}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300 pt-2 border-t border-slate-900">
                <span>Seat Price: ${selectedRideModal.pricePerSeatUSD}</span>
                <span>{selectedRideModal.seatsAvailable} of {selectedRideModal.totalSeats} Seats Left</span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSelectedRideModal(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs transition"
              >
                Close
              </button>
              <button
                onClick={() => {
                  toggleBookSeat(selectedRideModal.id);
                  setSelectedRideModal(null);
                }}
                className={`px-5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                  selectedRideModal.isBooked
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/30'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                {selectedRideModal.isBooked ? 'Cancel Seat Reservation' : 'Reserve Carpool Seat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
