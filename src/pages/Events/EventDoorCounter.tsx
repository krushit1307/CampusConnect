import React, { useState, useEffect } from 'react';
import { DoorOpen, Users, TrendingUp, AlertTriangle, CheckCircle2, Minus, Plus, RefreshCcw, Settings2 } from 'lucide-react';

interface EventData {
  id: string;
  eventName: string;
  venue: string;
  capacity: number;
  attendees: number;
}

const INITIAL_EVENTS: EventData[] = [
  { id: 'evt-1', eventName: 'AI & ML Hackathon 2026', venue: 'Innovation Hub', capacity: 250, attendees: 198 },
  { id: 'evt-2', eventName: 'Global Cultural Night', venue: 'Campus Green Pavilion', capacity: 500, attendees: 312 },
  { id: 'evt-3', eventName: 'Quantum Physics Symposium', venue: 'Science Complex', capacity: 120, attendees: 75 },
];

export default function EventDoorCounter() {
  const [events, setEvents] = useState<EventData[]>(INITIAL_EVENTS);
  const [selectedEventId, setSelectedEventId] = useState<string>(INITIAL_EVENTS[0].id);
  const [doorCount, setDoorCount] = useState<number>(0);
  const [isRealtime, setIsRealtime] = useState<boolean>(true);

  const selectedEvent = events.find(event => event.id === selectedEventId) || INITIAL_EVENTS[0];

  // Simulate Real-Time Data Updates
  useEffect(() => {
    if (!isRealtime) return;
    const interval = setInterval(() => {
      setDoorCount(prev => Math.min(prev + 1, selectedEvent.capacity));
    }, 3000);
    return () => clearInterval(interval);
  }, [isRealtime, selectedEvent.capacity]);

  const addAttendee = (eventId: string) => {
    setEvents(prev => prev.map(event => 
      event.id === eventId ? { ...event, attendees: Math.min(event.attendees + 1, event.capacity) } : event
    ));
  };

  const removeAttendee = (eventId: string) => {
    setEvents(prev => prev.map(event => 
      event.id === eventId ? { ...event, attendees: Math.max(event.attendees - 1, 0) } : event
    ));
  };

  const calculateCapacity = (attendees: number, capacity: number) => {
    return Math.round((attendees / capacity) * 100);
  };

  const getCapacityColor = (percent: number) => {
    if (percent >= 90) return 'text-rose-400';
    if (percent >= 70) return 'text-yellow-400';
    return 'text-emerald-400';
  };

  const getCapacityBackground = (percent: number) => {
    if (percent >= 90) return 'bg-rose-500';
    if (percent >= 70) return 'bg-yellow-500';
    return 'bg-emerald-500';
  };

  const resetCounter = () => {
    setDoorCount(0);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="bg-gradient-to-r from-blue-900/60 via-cyan-900/40 to-slate-900 border border-blue-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="absolute -right-10 -top-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-blue-500/20 text-blue-300 text-xs px-3 py-1 rounded-full font-semibold border border-blue-500/30 flex items-center gap-1.5">
                  <DoorOpen className="w-3.5 h-3.5" /> Real-Time Tracking
                </span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-blue-200 bg-clip-text text-transparent">
                Event Capacity Door Counter
              </h1>
              <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
                Monitor live attendance and capacity levels for ongoing campus events.
              </p>
            </div>
            <button onClick={resetCounter} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 rounded-xl font-medium transition flex items-center gap-2 border border-slate-700 text-sm">
              <RefreshCcw className="w-4 h-4" /> Reset Counter
            </button>
          </div>
        </header>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 rounded-xl"><Users className="w-6 h-6 text-blue-400" /></div>
              <div>
                <p className="text-2xl font-bold">{selectedEvent.attendees}</p>
                <p className="text-slate-400 text-xs">Current Attendees</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 rounded-xl"><CheckCircle2 className="w-6 h-6 text-emerald-400" /></div>
              <div>
                <p className="text-2xl font-bold">{selectedEvent.capacity}</p>
                <p className="text-slate-400 text-xs">Total Capacity</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-500/10 rounded-xl"><TrendingUp className="w-6 h-6 text-yellow-400" /></div>
              <div>
                <p className={`text-2xl font-bold ${getCapacityColor(calculateCapacity(selectedEvent.attendees, selectedEvent.capacity))}`}>
                  {calculateCapacity(selectedEvent.attendees, selectedEvent.capacity)}%
                </p>
                <p className="text-slate-400 text-xs">Capacity Used</p>
              </div>
            </div>
          </div>
        </div>

        {/* Event Selector */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4"><Settings2 className="w-5 h-5 text-blue-400" /> Select Event</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {events.map(event => (
              <button
                key={event.id}
                onClick={() => setSelectedEventId(event.id)}
                className={`text-left p-4 rounded-2xl border transition ${
                  selectedEventId === event.id 
                    ? 'bg-blue-500/10 border-blue-500/30' 
                    : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'
                }`}
              >
                <p className="font-semibold text-white">{event.eventName}</p>
                <p className="text-xs text-slate-400 mt-1">{event.venue}</p>
                <div className="mt-2">
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${getCapacityBackground(calculateCapacity(event.attendees, event.capacity))}`}
                      style={{ width: `${calculateCapacity(event.attendees, event.capacity)}%` }}
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Counter Dashboard */}
        <div className="bg-slate-900/80 border border-blue-500/20 rounded-3xl p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <h2 className="text-2xl font-bold flex items-center gap-2"><DoorOpen className="w-6 h-6 text-blue-400" /> Door Counter</h2>
              <p className="text-slate-400 text-sm mt-2">Manually adjust the count or let the real-time simulation update it.</p>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => removeAttendee(selectedEvent.id)}
                className="p-4 rounded-2xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 transition"
              >
                <Minus className="w-6 h-6" />
              </button>
              
              <div className="text-center">
                <p className="text-6xl font-extrabold text-white">{selectedEvent.attendees}</p>
                <p className="text-xs text-slate-400 mt-1">People Inside</p>
              </div>

              <button 
                onClick={() => addAttendee(selectedEvent.id)}
                className="p-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white transition shadow-lg shadow-blue-600/30"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="mt-8">
            <div className="w-full bg-slate-800 rounded-full h-4">
              <div 
                className={`h-4 rounded-full ${getCapacityBackground(calculateCapacity(selectedEvent.attendees, selectedEvent.capacity))}`}
                style={{ width: `${calculateCapacity(selectedEvent.attendees, selectedEvent.capacity)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-400">
              <span>0</span>
              <span>{selectedEvent.capacity}</span>
            </div>
          </div>

          {calculateCapacity(selectedEvent.attendees, selectedEvent.capacity) >= 90 && (
            <div className="mt-6 flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <p className="text-sm text-rose-300">Warning: This event is at 90% capacity!</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}