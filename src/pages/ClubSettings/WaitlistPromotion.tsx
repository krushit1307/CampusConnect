import React, { useState, useEffect } from 'react';
import { Clock, Users, UserCheck, AlertTriangle, CheckCircle2, Timer, RefreshCcw, ArrowRight, ListOrdered, XCircle } from 'lucide-react';

interface WaitlistEntry {
  id: string;
  name: string;
  joinTime: number; // Timestamp
  ttlMinutes: number; // Time-to-live in minutes
  status: 'Waiting' | 'Promoted' | 'Expired';
}

const INITIAL_WAITLIST: WaitlistEntry[] = [
  { id: 'w-1', name: 'Aarav Sharma', joinTime: Date.now() - 50 * 60 * 1000, ttlMinutes: 60, status: 'Waiting' },
  { id: 'w-2', name: 'Priya Patel', joinTime: Date.now() - 30 * 60 * 1000, ttlMinutes: 60, status: 'Waiting' },
  { id: 'w-3', name: 'Rohan Mehta', joinTime: Date.now() - 10 * 60 * 1000, ttlMinutes: 60, status: 'Waiting' },
];

export default function WaitlistPromotion() {
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>(INITIAL_WAITLIST);
  const [selectedTtl, setSelectedTtl] = useState<number>(60);
  const [notification, setNotification] = useState('');

  // Simulate real-time TTL enforcement
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      
      setWaitlist(prev => {
        // Determine which entries have expired based on TTL
        const expiredEntries = prev.filter(entry => 
          entry.status === 'Waiting' && (now - entry.joinTime) > entry.ttlMinutes * 60 * 1000
        );

        if (expiredEntries.length > 0) {
          setNotification(`${expiredEntries.length} waitlist entries expired and were automatically removed.`);
          setTimeout(() => setNotification(''), 3000);
          
          // Remove expired and promote the next person
          const remaining = prev.filter(entry => !expiredEntries.includes(entry));
          
          // Promote the first person in the list
          if (remaining.length > 0 && remaining[0].status === 'Waiting') {
            remaining[0] = { ...remaining[0], status: 'Promoted' };
          }
          
          return remaining;
        }
        
        return prev;
      });
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(interval);
  }, []);

  const promoteNext = () => {
    const nextWaiting = waitlist.find(entry => entry.status === 'Waiting');
    if (nextWaiting) {
      setWaitlist(prev => prev.map(entry => 
        entry.id === nextWaiting.id ? { ...entry, status: 'Promoted' } : entry
      ));
      setNotification(`${nextWaiting.name} has been promoted from the waitlist!`);
      setTimeout(() => setNotification(''), 3000);
    }
  };

  const addToWaitlist = () => {
    const newEntry: WaitlistEntry = {
      id: `w-${Date.now()}`,
      name: `Student ${waitlist.length + 1}`,
      joinTime: Date.now(),
      ttlMinutes: selectedTtl,
      status: 'Waiting',
    };
    setWaitlist(prev => [...prev, newEntry]);
    setNotification(`New student added to waitlist with ${selectedTtl} minute TTL.`);
    setTimeout(() => setNotification(''), 3000);
  };

  const resetWaitlist = () => {
    setWaitlist(INITIAL_WAITLIST);
    setNotification('');
  };

  const waitingCount = waitlist.filter(entry => entry.status === 'Waiting').length;
  const promotedCount = waitlist.filter(entry => entry.status === 'Promoted').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="bg-gradient-to-r from-teal-900/60 via-cyan-900/40 to-slate-900 border border-teal-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="absolute -right-10 -top-10 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-teal-500/20 text-teal-300 text-xs px-3 py-1 rounded-full font-semibold border border-teal-500/30 flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5" /> Strict TTL Enforcement
                </span>
                <span className="text-slate-400 text-xs flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-cyan-400" /> {waitingCount} Waiting
                </span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-teal-200 bg-clip-text text-transparent">
                Automated Waitlist Promotion (Strict TTL)
              </h1>
              <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
                Automatically enforce time-to-live rules and promote the next student when a spot opens up.
              </p>
            </div>
            <button onClick={resetWaitlist} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 rounded-xl font-medium transition flex items-center gap-2 border border-slate-700 text-sm">
              <RefreshCcw className="w-4 h-4" /> Reset Waitlist
            </button>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-500/10 rounded-xl"><Clock className="w-6 h-6 text-yellow-400" /></div>
              <div>
                <p className="text-2xl font-bold">{waitingCount}</p>
                <p className="text-slate-400 text-xs">Waiting</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 rounded-xl"><UserCheck className="w-6 h-6 text-emerald-400" /></div>
              <div>
                <p className="text-2xl font-bold">{promotedCount}</p>
                <p className="text-slate-400 text-xs">Promoted</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-cyan-500/10 rounded-xl"><ListOrdered className="w-6 h-6 text-cyan-400" /></div>
              <div>
                <p className="text-2xl font-bold">{waitlist.length}</p>
                <p className="text-slate-400 text-xs">Total in Queue</p>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-300 mb-2">Strict TTL (Minutes)</label>
            <select 
              value={selectedTtl}
              onChange={(e) => setSelectedTtl(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-teal-500"
            >
              <option value={15}>15 Minutes</option>
              <option value={30}>30 Minutes</option>
              <option value={60}>60 Minutes</option>
              <option value={120}>120 Minutes</option>
            </select>
          </div>
          <button 
            onClick={addToWaitlist}
            className="w-full md:w-auto bg-teal-600 hover:bg-teal-500 text-white px-6 py-3 rounded-xl font-medium transition shadow-lg shadow-teal-600/30 flex items-center justify-center gap-2"
          >
            <Users className="w-4 h-4" /> Add to Waitlist
          </button>
          <button 
            onClick={promoteNext}
            className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-medium transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
          >
            <ArrowRight className="w-4 h-4" /> Promote Next
          </button>
        </div>

        {/* Waitlist Table */}
        <div className="bg-slate-900/80 border border-teal-500/20 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-slate-800">
            <h2 className="text-xl font-bold flex items-center gap-2"><ListOrdered className="w-5 h-5 text-teal-400" /> Current Queue</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Position</th>
                  <th className="py-4 px-6">Name</th>
                  <th className="py-4 px-6">Time Remaining</th>
                  <th className="py-4 px-6">Status</th>
                </tr>
              </thead>
              <tbody>
                {waitlist.map((entry, index) => {
                  const timeRemaining = Math.max(0, entry.ttlMinutes * 60 * 1000 - (Date.now() - entry.joinTime));
                  const minutesRemaining = Math.floor(timeRemaining / 60000);
                  const secondsRemaining = Math.floor((timeRemaining % 60000) / 1000);
                  
                  return (
                    <tr key={entry.id} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/20 transition">
                      <td className="py-4 px-6 font-bold text-white">#{index + 1}</td>
                      <td className="py-4 px-6 font-medium text-white">{entry.name}</td>
                      <td className="py-4 px-6">
                        {entry.status === 'Waiting' ? (
                          <span className="text-cyan-300 font-mono text-sm">
                            {minutesRemaining}:{secondsRemaining.toString().padStart(2, '0')}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                          entry.status === 'Promoted' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 
                          entry.status === 'Expired' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                          'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                        }`}>
                          {entry.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notification */}
        {notification && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-sm text-emerald-300 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5" />
            {notification}
          </div>
        )}

        {/* TTL Warning */}
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3 bg-rose-500/20 rounded-full">
            <AlertTriangle className="w-6 h-6 text-rose-300" />
          </div>
          <div>
            <h3 className="font-bold text-rose-300">Strict TTL Warning</h3>
            <p className="text-slate-400 text-sm">Waitlist entries will automatically expire and be removed after their TTL time elapses.</p>
          </div>
        </div>

      </div>
    </div>
  );
}