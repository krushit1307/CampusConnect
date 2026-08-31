import React, { useState } from 'react';
import { ImageOff, UserCheck, Users, AlertTriangle, CheckCircle2, Search, Mail, CalendarDays, Briefcase, RefreshCcw, ArrowRight } from 'lucide-react';

interface Historian {
  id: string;
  name: string;
  role: string;
  email: string;
  hasPhoto: boolean;
}

const INITIAL_HISTORIANS: Historian[] = [
  { id: 'h-1', name: 'Aarav Sharma', role: 'President', email: 'aarav@campus.edu', hasPhoto: true },
  { id: 'h-2', name: 'Priya Patel', role: 'Vice President', email: 'priya@campus.edu', hasPhoto: false },
  { id: 'h-3', name: 'Rohan Mehta', role: 'Treasurer', email: 'rohan@campus.edu', hasPhoto: false },
  { id: 'h-4', name: 'Sneha Gupta', role: 'Secretary', email: 'sneha@campus.edu', hasPhoto: true },
];

export default function MissingPhotoReassignment() {
  const [historians, setHistorians] = useState<Historian[]>(INITIAL_HISTORIANS);
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState('');

  const missingPhotoCount = historians.filter(h => !h.hasPhoto).length;

  const filteredHistorians = historians.filter(historian => 
    historian.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sendReminderEmail = (historianId: string) => {
    setNotification(`Reminder email sent to ${historians.find(h => h.id === historianId)?.name}`);
    setTimeout(() => setNotification(''), 3000);
  };

  const requestNewPhoto = (historianId: string) => {
    setHistorians(prev => prev.map(h => 
      h.id === historianId ? { ...h, hasPhoto: true } : h
    ));
    setNotification('Photo request sent and status updated successfully!');
    setTimeout(() => setNotification(''), 3000);
  };

  const resetHistorians = () => {
    setHistorians(INITIAL_HISTORIANS);
    setNotification('');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="bg-gradient-to-r from-purple-900/60 via-violet-900/40 to-slate-900 border border-purple-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="absolute -right-10 -top-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-purple-500/20 text-purple-300 text-xs px-3 py-1 rounded-full font-semibold border border-purple-500/30 flex items-center gap-1.5">
                  <ImageOff className="w-3.5 h-3.5" /> Historian Tracker
                </span>
                <span className="text-slate-400 text-xs flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-violet-400" /> {missingPhotoCount} Missing Photos
                </span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-purple-200 bg-clip-text text-transparent">
                Missing Photo Historian Reassignment
              </h1>
              <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
                Automatically identify historians without profile photos and send assignment reminders.
              </p>
            </div>
            <button onClick={resetHistorians} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 rounded-xl font-medium transition flex items-center gap-2 border border-slate-700 text-sm">
              <RefreshCcw className="w-4 h-4" /> Reset Historians
            </button>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 rounded-xl"><CheckCircle2 className="w-6 h-6 text-emerald-400" /></div>
              <div>
                <p className="text-2xl font-bold">{historians.length - missingPhotoCount}</p>
                <p className="text-slate-400 text-xs">With Photos</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-500/10 rounded-xl"><AlertTriangle className="w-6 h-6 text-yellow-400" /></div>
              <div>
                <p className="text-2xl font-bold">{missingPhotoCount}</p>
                <p className="text-slate-400 text-xs">Missing Photos</p>
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
              placeholder="Search historian by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Historian List */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-slate-800">
            <h2 className="text-xl font-bold flex items-center gap-2"><Users className="w-5 h-5 text-purple-400" /> Historian List</h2>
          </div>
          <div className="divide-y divide-slate-800">
            {filteredHistorians.map(historian => (
              <div key={historian.id} className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-800/20 transition">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl ${
                    historian.hasPhoto ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                  }`}>
                    {historian.hasPhoto ? historian.name.charAt(0) : <ImageOff className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{historian.name}</h3>
                    <p className="text-sm text-slate-400">{historian.role}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {historian.email}</span>
                      <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Joined 2026</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {!historian.hasPhoto && (
                    <button 
                      onClick={() => sendReminderEmail(historian.id)}
                      className="px-3 py-2 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <Mail className="w-3.5 h-3.5" /> Send Reminder
                    </button>
                  )}
                  <button 
                    onClick={() => requestNewPhoto(historian.id)}
                    className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Request New Photo
                  </button>
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
            <Briefcase className="w-6 h-6 text-purple-400" />
            <div>
              <h3 className="font-semibold text-white">Automated Reassignment</h3>
              <p className="text-xs text-slate-400">Ensure every historian has an updated profile photo.</p>
            </div>
          </div>
          <ArrowRight className="w-6 h-6 text-slate-600" />
        </div>

      </div>
    </div>
  );
}