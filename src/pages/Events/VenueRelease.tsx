import React, { useState } from 'react';
import { MapPin, CalendarDays, AlertTriangle, CheckCircle2, XCircle, RefreshCcw, Building2, Clock, Search, ArrowRight, Ban } from 'lucide-react';

interface EventItem {
  id: string;
  eventName: string;
  venue: string;
  date: string;
  time: string;
  status: 'Scheduled' | 'Cancelled';
}

const INITIAL_EVENTS: EventItem[] = [
  { id: 'e-1', eventName: 'AI & ML Hackathon 2026', venue: 'Innovation Hub', date: '2026-09-15', time: '09:00 AM', status: 'Scheduled' },
  { id: 'e-2', eventName: 'Global Cultural Night', venue: 'Campus Green Pavilion', date: '2026-10-05', time: '05:00 PM', status: 'Scheduled' },
  { id: 'e-3', eventName: 'Quantum Physics Symposium', venue: 'Science Complex, Hall B', date: '2026-09-20', time: '01:30 PM', status: 'Scheduled' },
  { id: 'e-4', eventName: 'Esports Tournament', venue: 'Student Union Center', date: '2026-09-28', time: '11:00 AM', status: 'Cancelled' },
];

export default function VenueRelease() {
  const [events, setEvents] = useState<EventItem[]>(INITIAL_EVENTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [releasedVenues, setReleasedVenues] = useState<string[]>([]);
  const [notification, setNotification] = useState('');

  const filteredEvents = events.filter(event => 
    event.eventName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const cancelEvent = (eventId: string) => {
    setEvents(prev => prev.map(event => 
      event.id === eventId ? { ...event, status: 'Cancelled' } : event
    ));
    setNotification('Event successfully cancelled. Venue is now available for release.');
    setTimeout(() => setNotification(''), 3000);
  };

  const releaseVenue = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (event && !releasedVenues.includes(event.venue)) {
      setReleasedVenues(prev => [...prev, event.venue]);
      setNotification(`Venue "${event.venue}" has been successfully released back to the pool!`);
      setTimeout(() => setNotification(''), 3000);
    }
  };

  const resetSystem = () => {
    setEvents(INITIAL_EVENTS);
    setReleasedVenues([]);
    setNotification('');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="bg-gradient-to-r from-orange-900/60 via-amber-900/40 to-slate-900 border border-orange-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="absolute -right-10 -top-10 w-72 h-72 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-orange-500/20 text-orange-300 text-xs px-3 py-1 rounded-full font-semibold border border-orange-500/30 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> Venue Management
                </span>
                <span className="text-slate-400 text-xs flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" /> {events.filter(e => e.status === 'Cancelled').length} Cancelled Events
                </span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-orange-200 bg-clip-text text-transparent">
                Automated Event Cancellation Venue Release
              </h1>
              <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
                Automatically manage and release event venues when events are cancelled.
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
              <div className="p-3 bg-emerald-500/10 rounded-xl"><Building2 className="w-6 h-6 text-emerald-400" /></div>
              <div>
                <p className="text-2xl font-bold">{events.length}</p>
                <p className="text-slate-400 text-xs">Total Events</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-500/10 rounded-xl"><XCircle className="w-6 h-6 text-yellow-400" /></div>
              <div>
                <p className="text-2xl font-bold">{events.filter(e => e.status === 'Cancelled').length}</p>
                <p className="text-slate-400 text-xs">Cancelled Events</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 rounded-xl"><CheckCircle2 className="w-6 h-6 text-blue-400" /></div>
              <div>
                <p className="text-2xl font-bold">{releasedVenues.length}</p>
                <p className="text-slate-400 text-xs">Venues Released</p>
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
              placeholder="Search event name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>

        {/* Event List */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-slate-800">
            <h2 className="text-xl font-bold flex items-center gap-2"><CalendarDays className="w-5 h-5 text-orange-400" /> Scheduled Events</h2>
          </div>
          <div className="divide-y divide-slate-800">
            {filteredEvents.map(event => (
              <div key={event.id} className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-800/20 transition">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-lg">{event.eventName}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {event.venue}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {event.date} at {event.time}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {event.status === 'Scheduled' ? (
                    <>
                      <button 
                        onClick={() => cancelEvent(event.id)}
                        className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <Ban className="w-3.5 h-3.5" /> Cancel Event
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="px-3 py-2 rounded-lg bg-yellow-500/10 text-yellow-400 text-xs font-bold border border-yellow-500/30">
                        Cancelled
                      </span>
                      {!releasedVenues.includes(event.venue) ? (
                        <button 
                          onClick={() => releaseVenue(event.id)}
                          className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                        >
                          <Building2 className="w-3.5 h-3.5" /> Release Venue
                        </button>
                      ) : (
                        <span className="px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/30 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Released
                        </span>
                      )}
                    </>
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
            <ArrowRight className="w-6 h-6 text-orange-400" />
            <div>
              <h3 className="font-semibold text-white">Automated Venue Release</h3>
              <p className="text-xs text-slate-400">Ensure no venue is left unused when an event is cancelled.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}