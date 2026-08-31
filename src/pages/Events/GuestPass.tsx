import React, { useState } from 'react';
import { Ticket, Users, CheckCircle2, XCircle, RefreshCcw, Search, Building2, ShieldCheck, AlertTriangle, QrCode, ArrowRight, Ban } from 'lucide-react';

interface GuestPass {
  id: string;
  studentName: string;
  homeCampus: string;
  visitingCampus: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Revoked';
}

const INITIAL_PASSES: GuestPass[] = [
  { id: 'g-1', studentName: 'Aarav Sharma', homeCampus: 'North Campus', visitingCampus: 'Main Campus', reason: 'Hackathon Participation', status: 'Approved' },
  { id: 'g-2', studentName: 'Priya Patel', homeCampus: 'East Campus', visitingCampus: 'Main Campus', reason: 'Library Access', status: 'Pending' },
  { id: 'g-3', studentName: 'Rohan Mehta', homeCampus: 'South Campus', visitingCampus: 'North Campus', reason: 'Sports Event', status: 'Pending' },
  { id: 'g-4', studentName: 'Sneha Gupta', homeCampus: 'Main Campus', visitingCampus: 'East Campus', reason: 'Guest Lecture', status: 'Revoked' },
];

const CAMPUS_LIST = ['Main Campus', 'North Campus', 'South Campus', 'East Campus'];

export default function GuestPass() {
  const [passes, setPasses] = useState<GuestPass[]>(INITIAL_PASSES);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [notification, setNotification] = useState('');

  const filteredPasses = passes.filter(pass => {
    const matchesSearch = pass.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          pass.homeCampus.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          pass.visitingCampus.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'All' || pass.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const updateStatus = (passId: string, status: 'Approved' | 'Revoked') => {
    setPasses(prev => prev.map(pass => 
      pass.id === passId ? { ...pass, status } : pass
    ));
    const student = passes.find(p => p.id === passId)?.studentName;
    setNotification(`${student}'s pass has been ${status.toLowerCase()} successfully.`);
    setTimeout(() => setNotification(''), 3000);
  };

  const resetSystem = () => {
    setPasses(INITIAL_PASSES);
    setSearchQuery('');
    setFilterStatus('All');
    setNotification('');
  };

  const approvedCount = passes.filter(pass => pass.status === 'Approved').length;
  const pendingCount = passes.filter(pass => pass.status === 'Pending').length;
  const revokedCount = passes.filter(pass => pass.status === 'Revoked').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="bg-gradient-to-r from-cyan-900/60 via-blue-900/40 to-slate-900 border border-cyan-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="absolute -right-10 -top-10 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-cyan-500/20 text-cyan-300 text-xs px-3 py-1 rounded-full font-semibold border border-cyan-500/30 flex items-center gap-1.5">
                  <Ticket className="w-3.5 h-3.5" /> Inter-Campus Access
                </span>
                <span className="text-slate-400 text-xs flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-blue-400" /> {passes.length} Total Passes
                </span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-cyan-200 bg-clip-text text-transparent">
                Dynamic Multi-Campus Guest Pass
              </h1>
              <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
                Manage and approve guest passes for students visiting from different campuses.
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
                <p className="text-2xl font-bold">{approvedCount}</p>
                <p className="text-slate-400 text-xs">Approved</p>
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
              <div className="p-3 bg-rose-500/10 rounded-xl"><XCircle className="w-6 h-6 text-rose-400" /></div>
              <div>
                <p className="text-2xl font-bold">{revokedCount}</p>
                <p className="text-slate-400 text-xs">Revoked</p>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student, home campus, or visiting campus..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Revoked">Revoked</option>
          </select>
        </div>

        {/* Pass List */}
        <div className="bg-slate-900/80 border border-cyan-500/20 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-slate-800">
            <h2 className="text-xl font-bold flex items-center gap-2"><Ticket className="w-5 h-5 text-cyan-400" /> Guest Pass Requests</h2>
          </div>
          <div className="divide-y divide-slate-800">
            {filteredPasses.map(pass => (
              <div key={pass.id} className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-800/20 transition">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-lg">{pass.studentName}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {pass.homeCampus} → {pass.visitingCampus}</span>
                      <span>{pass.reason}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                    pass.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 
                    pass.status === 'Revoked' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                    'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                  }`}>
                    {pass.status}
                  </span>
                  {pass.status !== 'Approved' && (
                    <button 
                      onClick={() => updateStatus(pass.id, 'Approved')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </button>
                  )}
                  {pass.status !== 'Revoked' && (
                    <button 
                      onClick={() => updateStatus(pass.id, 'Revoked')}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <Ban className="w-3.5 h-3.5" /> Revoke
                    </button>
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
            <QrCode className="w-6 h-6 text-cyan-400" />
            <div>
              <h3 className="font-semibold text-white">Digital Pass Verification</h3>
              <p className="text-xs text-slate-400">Students can present their digital pass for entry at the gate.</p>
            </div>
          </div>
          <ArrowRight className="w-6 h-6 text-slate-600" />
        </div>

      </div>
    </div>
  );
}