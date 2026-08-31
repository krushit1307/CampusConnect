import React, { useState } from 'react';
import { Users, UserX, AlertTriangle, CheckCircle2, Filter, Trash2, ShieldCheck, Clock, RefreshCcw, Database } from 'lucide-react';

interface ClubMember {
  id: string;
  name: string;
  role: string;
  lastActiveDate: string;
  eventsAttended: number;
}

const INITIAL_MEMBERS: ClubMember[] = [
  { id: 'm-101', name: 'Aarav Sharma', role: 'Member', lastActiveDate: '2026-07-15', eventsAttended: 5 },
  { id: 'm-102', name: 'Priya Patel', role: 'Treasurer', lastActiveDate: '2026-08-01', eventsAttended: 10 },
  { id: 'm-103', name: 'Rohan Mehta', role: 'Member', lastActiveDate: '2026-05-20', eventsAttended: 1 },
  { id: 'm-104', name: 'Sneha Gupta', role: 'Member', lastActiveDate: '2026-02-10', eventsAttended: 0 },
  { id: 'm-105', name: 'Kabir Singh', role: 'Member', lastActiveDate: '2025-12-01', eventsAttended: 2 },
  { id: 'm-106', name: 'Ananya Iyer', role: 'Secretary', lastActiveDate: '2026-08-15', eventsAttended: 8 },
];

const INACTIVITY_THRESHOLD_MONTHS = 3;

export default function InactiveMemberPruning() {
  const [members, setMembers] = useState<ClubMember[]>(INITIAL_MEMBERS);
  const [threshold, setThreshold] = useState<number>(INACTIVITY_THRESHOLD_MONTHS);
  const [prunedCount, setPrunedCount] = useState<number>(0);
  const [hasPruned, setHasPruned] = useState<boolean>(false);

  const getMonthsInactive = (dateString: string) => {
    const lastActive = new Date(dateString);
    const now = new Date();
    return (now.getFullYear() - lastActive.getFullYear()) * 12 + (now.getMonth() - lastActive.getMonth());
  };

  const inactiveMembers = members.filter(member => {
    const monthsInactive = getMonthsInactive(member.lastActiveDate);
    return monthsInactive >= threshold || member.eventsAttended === 0;
  });

  const activeMembers = members.filter(member => {
    const monthsInactive = getMonthsInactive(member.lastActiveDate);
    return monthsInactive < threshold && member.eventsAttended > 0;
  });

  const pruneInactiveMembers = () => {
    const count = inactiveMembers.length;
    setMembers(prev => prev.filter(member => {
      const monthsInactive = getMonthsInactive(member.lastActiveDate);
      return monthsInactive < threshold && member.eventsAttended > 0;
    }));
    setPrunedCount(count);
    setHasPruned(true);
  };

  const resetMembers = () => {
    setMembers(INITIAL_MEMBERS);
    setPrunedCount(0);
    setHasPruned(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <header className="bg-gradient-to-r from-rose-900/60 via-red-900/40 to-slate-900 border border-rose-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="absolute -right-10 -top-10 w-72 h-72 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-rose-500/20 text-rose-300 text-xs px-3 py-1 rounded-full font-semibold border border-rose-500/30 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" /> Member Cleanup
                </span>
                <span className="text-slate-400 text-xs flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-red-400" /> Threshold: {threshold} Months
                </span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-rose-200 bg-clip-text text-transparent">
                Inactive Member Pruning
              </h1>
              <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
                Automatically identify and prune members who have been inactive for a specified period.
              </p>
            </div>
            <button onClick={resetMembers} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 rounded-xl font-medium transition flex items-center gap-2 border border-slate-700 text-sm">
              <RefreshCcw className="w-4 h-4" /> Reset Members
            </button>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 rounded-xl"><Users className="w-6 h-6 text-blue-400" /></div>
              <div>
                <p className="text-2xl font-bold">{activeMembers.length}</p>
                <p className="text-slate-400 text-xs">Active Members</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-500/10 rounded-xl"><AlertTriangle className="w-6 h-6 text-yellow-400" /></div>
              <div>
                <p className="text-2xl font-bold">{inactiveMembers.length}</p>
                <p className="text-slate-400 text-xs">Inactive Candidates</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 rounded-xl"><Trash2 className="w-6 h-6 text-emerald-400" /></div>
              <div>
                <p className="text-2xl font-bold">{prunedCount}</p>
                <p className="text-slate-400 text-xs">Pruned</p>
              </div>
            </div>
          </div>
        </div>

        {/* Config */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4"><Filter className="w-5 h-5 text-rose-400" /> Pruning Configuration</h2>
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-300 mb-2">Inactivity Threshold (Months)</label>
              <input 
                type="number" 
                min={1}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
              />
            </div>
            <button 
              onClick={pruneInactiveMembers}
              className="w-full md:w-auto bg-rose-600 hover:bg-rose-500 text-white px-6 py-3 rounded-xl font-medium transition shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Prune Inactive Members
            </button>
          </div>

          {hasPruned && (
            <div className="mt-4 flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <p className="text-sm text-emerald-300">Successfully pruned {prunedCount} inactive member(s) from the list.</p>
            </div>
          )}
        </div>

        {/* Member Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Active Members */}
          <div className="bg-slate-900/80 border border-emerald-500/20 rounded-3xl p-6">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-emerald-400"><ShieldCheck className="w-5 h-5" /> Active Members ({activeMembers.length})</h2>
            <div className="space-y-3">
              {activeMembers.map(member => (
                <div key={member.id} className="flex items-center justify-between bg-slate-800/50 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-lg">
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-white">{member.name}</p>
                      <p className="text-xs text-slate-400">{member.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-400">{member.eventsAttended} Events</p>
                    <p className="text-xs text-slate-500">Active</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Inactive Members */}
          <div className="bg-slate-900/80 border border-rose-500/20 rounded-3xl p-6">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-rose-400"><UserX className="w-5 h-5" /> Inactive Candidates ({inactiveMembers.length})</h2>
            <div className="space-y-3">
              {inactiveMembers.map(member => (
                <div key={member.id} className="flex items-center justify-between bg-slate-800/50 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400 font-bold text-lg">
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-white">{member.name}</p>
                      <p className="text-xs text-slate-400">{member.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-rose-400">{getMonthsInactive(member.lastActiveDate)} Months</p>
                    <p className="text-xs text-slate-500">Inactive</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}