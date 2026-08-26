import React, { useState } from 'react';
import { Accessibility, BellRing, CheckCircle2, Clock, AlertCircle, Calendar, User, PlusCircle, X, Heart, ShieldCheck, Wand2 } from 'lucide-react';

interface Accommodation {
  id: string;
  user: string;
  requestType: string;
  eventDate: string;
  details: string;
  status: 'Pending' | 'Confirmed' | 'Urgent';
  createdAt: string;
}

const INITIAL_ACCOMMODATIONS: Accommodation[] = [
  {
    id: 'acc-101',
    user: 'Aarav Sharma',
    requestType: 'Wheelchair Access',
    eventDate: '2026-09-15',
    details: 'Needs access to the main auditorium stage.',
    status: 'Confirmed',
    createdAt: '2026-08-20',
  },
  {
    id: 'acc-102',
    user: 'Priya Patel',
    requestType: 'Sign Language Interpreter',
    eventDate: '2026-09-20',
    details: 'Requesting a certified interpreter for the keynote session.',
    status: 'Pending',
    createdAt: '2026-08-21',
  },
  {
    id: 'acc-103',
    user: 'Rohan Mehta',
    requestType: 'Large Print Materials',
    eventDate: '2026-09-15',
    details: 'Requires PDF handouts in 16pt font or higher.',
    status: 'Urgent',
    createdAt: '2026-08-22',
  },
];

export default function AccessibilityReminders() {
  const [accommodations, setAccommodations] = useState<Accommodation[]>(INITIAL_ACCOMMODATIONS);
  const [showModal, setShowModal] = useState(false);
  const [newRequest, setNewRequest] = useState({ user: '', requestType: '', eventDate: '', details: '' });

  const pendingCount = accommodations.filter(a => a.status !== 'Confirmed').length;
  const urgentCount = accommodations.filter(a => a.status === 'Urgent').length;

  const confirmRequest = (id: string) => {
    setAccommodations(prev => prev.map(acc => acc.id === id ? { ...acc, status: 'Confirmed' } : acc));
  };

  const removeRequest = (id: string) => {
    setAccommodations(prev => prev.filter(acc => acc.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newAcc: Accommodation = {
      id: `acc-${Date.now()}`,
      ...newRequest,
      status: 'Pending',
      createdAt: new Date().toISOString().split('T')[0],
    };
    setAccommodations(prev => [newAcc, ...prev]);
    setShowModal(false);
    setNewRequest({ user: '', requestType: '', eventDate: '', details: '' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="bg-gradient-to-r from-teal-900/60 via-emerald-900/40 to-slate-900 border border-emerald-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="absolute -left-10 -top-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-emerald-500/20 text-emerald-300 text-xs px-3 py-1 rounded-full font-semibold border border-emerald-500/30 flex items-center gap-1.5">
                  <Accessibility className="w-3.5 h-3.5" /> Inclusivity Hub
                </span>
                <span className="text-slate-400 text-xs flex items-center gap-1">
                  <BellRing className="w-3.5 h-3.5 text-teal-400" /> {pendingCount} Pending Requests
                </span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-emerald-200 bg-clip-text text-transparent">
                Accessibility Accommodation Reminders
              </h1>
              <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
                Manage accommodation requests, remind organizers of upcoming needs, and ensure equal access for all students.
              </p>
            </div>
            <button 
              onClick={() => setShowModal(true)}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-emerald-600/30 transition flex items-center gap-2 border border-emerald-400/20 text-sm"
            >
              <PlusCircle className="w-4 h-4" /> New Accommodation Request
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 rounded-xl"><CheckCircle2 className="w-6 h-6 text-emerald-400" /></div>
              <div>
                <p className="text-2xl font-bold">{accommodations.filter(a => a.status === 'Confirmed').length}</p>
                <p className="text-slate-400 text-xs">Confirmed</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-500/10 rounded-xl"><Clock className="w-6 h-6 text-yellow-400" /></div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-slate-400 text-xs">Pending</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-500/10 rounded-xl"><AlertCircle className="w-6 h-6 text-rose-400" /></div>
              <div>
                <p className="text-2xl font-bold">{urgentCount}</p>
                <p className="text-slate-400 text-xs">Urgent</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2"><Heart className="w-5 h-5 text-emerald-400" /> Active Requests</h2>
            <span className="text-xs text-slate-400">{accommodations.length} Total</span>
          </div>

          <div className="divide-y divide-slate-800">
            {accommodations.map((acc) => (
              <div key={acc.id} className="p-6 hover:bg-slate-800/20 transition group">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-slate-800 rounded-xl">
                      <User className="w-5 h-5 text-slate-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-white">{acc.user}</h3>
                        <span className={`text-xs px-2 py-1 rounded-md font-semibold border ${
                          acc.status === 'Confirmed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 
                          acc.status === 'Urgent' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                          'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                        }`}>{acc.status}</span>
                      </div>
                      <p className="text-slate-300 text-sm mt-1 font-medium flex items-center gap-2">
                        <Accessibility className="w-3.5 h-3.5 text-teal-400" /> {acc.requestType}
                      </p>
                      <p className="text-slate-400 text-xs mt-2">{acc.details}</p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {acc.eventDate}</span>
                        <span>Requested on {acc.createdAt}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start md:self-center">
                    <button 
                      onClick={() => confirmRequest(acc.id)}
                      className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition"
                      title="Confirm Request"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => removeRequest(acc.id)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                      title="Remove Request"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-r from-emerald-900/40 to-teal-900/40 border border-emerald-500/20 rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/20 rounded-full">
            <ShieldCheck className="w-6 h-6 text-emerald-300" />
          </div>
          <div>
            <h3 className="font-bold text-emerald-300">Accessibility Reminder System</h3>
            <p className="text-slate-400 text-sm">Automatic reminders are sent to organizers 48 hours before the event date.</p>
          </div>
          <Wand2 className="w-5 h-5 text-emerald-400 ml-auto hidden md:block" />
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">New Accommodation Request</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Student Name</label>
                <input 
                  type="text" 
                  required
                  value={newRequest.user}
                  onChange={(e) => setNewRequest({ ...newRequest, user: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Enter student name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Accommodation Type</label>
                <select 
                  required
                  value={newRequest.requestType}
                  onChange={(e) => setNewRequest({ ...newRequest, requestType: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Select type...</option>
                  <option value="Wheelchair Access">Wheelchair Access</option>
                  <option value="Sign Language Interpreter">Sign Language Interpreter</option>
                  <option value="Large Print Materials">Large Print Materials</option>
                  <option value="Screen Reader Support">Screen Reader Support</option>
                  <option value="Quiet Room Access">Quiet Room Access</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Event Date</label>
                <input 
                  type="date" 
                  required
                  value={newRequest.eventDate}
                  onChange={(e) => setNewRequest({ ...newRequest, eventDate: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Additional Details</label>
                <textarea 
                  value={newRequest.details}
                  onChange={(e) => setNewRequest({ ...newRequest, details: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 h-24 resize-none"
                  placeholder="Explain the specific requirements..."
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-medium transition shadow-lg shadow-emerald-600/30"
              >
                Submit Request
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}