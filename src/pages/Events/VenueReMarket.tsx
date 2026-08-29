import React, { useState } from 'react';
import { Building2, CalendarDays, AlertTriangle, CheckCircle2, RefreshCcw, Search, ArrowRight, Tag, Clock, Ban, Zap, Users } from 'lucide-react';

interface VenueSlot {
  id: string;
  eventName: string;
  venue: string;
  date: string;
  time: string;
  status: 'Booked' | 'Cancelled' | 'Re-Marketed';
  capacity: number;
}

const INITIAL_SLOTS: VenueSlot[] = [
  { id: 'v-1', eventName: 'AI & ML Hackathon', venue: 'Innovation Hub', date: '2026-09-15', time: '09:00 AM', status: 'Booked', capacity: 250 },
  { id: 'v-2', eventName: 'Cultural Night', venue: 'Campus Green', date: '2026-10-05', time: '05:00 PM', status: 'Booked', capacity: 500 },
  { id: 'v-3', eventName: 'Physics Symposium', venue: 'Science Complex', date: '2026-09-20', time: '01:30 PM', status: 'Cancelled', capacity: 120 },
  { id: 'v-4', eventName: 'Esports Tournament', venue: 'Student Union', date: '2026-09-28', time: '11:00 AM', status: 'Cancelled', capacity: 400 },
];

export default function VenueReMarket() {
  const [slots, setSlots] = useState<VenueSlot[]>(INITIAL_SLOTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState('');

  const filteredSlots = slots.filter(slot => 
    slot.eventName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    slot.venue.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const reMarketSlot = (slotId: string) => {
    setSlots(prev => prev.map(slot => 
      slot.id === slotId ? { ...slot, status: 'Re-Marketed' } : slot
    ));
    setNotification('Venue slot successfully re-marketed and available for new bookings!');
    setTimeout(() => setNotification(''), 3000);
  };

  const resetSystem = () => {
    setSlots(INITIAL_SLOTS);
    setSearchQuery('');
    setNotification('');
  };

  const bookedCount = slots.filter(slot => slot.status === 'Booked').length;
  const cancelledCount = slots.filter(slot => slot.status === 'Cancelled').length;
  const reMarketedCount = slots.filter(slot => slot.status === 'Re-Marketed').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="bg-gradient-to-r from-indigo-900/60 via-blue-900/40 to-slate-900 border border-indigo-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="absolute -right-10 -top-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-indigo-500/20 text-indigo-300 text-xs px-3 py-1 rounded-full font-semibold border border-indigo-500/30 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> Smart Scheduling
                </span>
                <span className="text-slate-400 text-xs flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-blue-400" /> Automated Re-Marketing
                </span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent">
                Automated Event Cancellation Venue Slot Re-Market
              </h1>
              <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
                Automatically re-list venue slots when events are cancelled to maximize resource usage.
              </p>
            </div>
            <button onClick={resetSystem} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 rounded-xl font-medium transition flex items-center gap-2 border border-slate-700 text-sm">
              <RefreshCcw className="w-4 h-4" /> Reset System
            </button>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 rounded-xl"><CheckCircle2 className="w-6 h-6 text-emerald-400" /></div>
              <div>
                <p className="text-2xl font-bold">{bookedCount}</p>
                <p className="text-slate-400 text-xs">Booked</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-500/10 rounded-xl"><Ban className="w-6 h-6 text-rose-400" /></div>
              <div>
                <p className="text-2xl font-bold">{cancelledCount}</p>
                <p className="text-slate-400 text-xs">Cancelled</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-500/10 rounded-xl"><Tag className="w-6 h-6 text-indigo-400" /></div>
              <div>
                <p className="text-2xl font-bold">{reMarketedCount}</p>
                <p className="text-slate-400 text-xs">Re-Marketed</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by event name or venue..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Venue Slot List */}
        <div className="bg-slate-900/80 border border-indigo-500/20 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-slate-800">
            <h2 className="text-xl font-bold flex items-center gap-2"><CalendarDays className="w-5 h-5 text-indigo-400" /> Venue Slots</h2>
          </div>
          <div className="divide-y divide-slate-800">
            {filteredSlots.map(slot => (
              <div key={slot.id} className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-800/20 transition">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-lg">{slot.eventName}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {slot.venue}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {slot.date} at {slot.time}</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {slot.capacity} Capacity</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {slot.status === 'Booked' && (
                    <span className="px-3 py-1.5 rounded-full text-xs font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                      Booked
                    </span>
                  )}
                  {slot.status === 'Cancelled' && (
                    <>
                      <span className="px-3 py-1.5 rounded-full text-xs font-bold border border-rose-500/30 bg-rose-500/10 text-rose-400">
                        Cancelled
                      </span>
                      <button 
                        onClick={() => reMarketSlot(slot.id)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <Tag className="w-3.5 h-3.5" /> Re-Market
                      </button>
                    </>
                  )}
                  {slot.status === 'Re-Marketed' && (
                    <span className="px-3 py-1.5 rounded-full text-xs font-bold border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Re-Marketed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notification */}
        {notification && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-sm text-emerald-300 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5" />
            {notification}
          </div>
        )}

        {/* Footer */}
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ArrowRight className="w-6 h-6 text-indigo-400" />
            <div>
              <h3 className="font-semibold text-white">Maximize Campus Resources</h3>
              <p className="text-xs text-slate-400">Ensure no venue is left unused when an event is cancelled.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}