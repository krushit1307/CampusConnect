import React, { useState } from 'react';
import { GraduationCap, Users, ClipboardList, CheckCircle2, AlertTriangle, ArrowRight, Mail, CalendarDays, Briefcase, Sparkles, RefreshCcw, Building2, FileText } from 'lucide-react';

interface AlumniMember {
  id: string;
  name: string;
  role: string;
  graduationYear: string;
  handoverStatus: 'Pending' | 'In Progress' | 'Completed';
  email: string;
  linkedin: string;
}

const INITIAL_ALUMNI: AlumniMember[] = [
  {
    id: 'a-1',
    name: 'Aarav Sharma',
    role: 'President',
    graduationYear: '2026',
    handoverStatus: 'Pending',
    email: 'aarav@campus.edu',
    linkedin: 'linkedin.com/in/aarav',
  },
  {
    id: 'a-2',
    name: 'Priya Patel',
    role: 'Vice President',
    graduationYear: '2026',
    handoverStatus: 'In Progress',
    email: 'priya@campus.edu',
    linkedin: 'linkedin.com/in/priya',
  },
  {
    id: 'a-3',
    name: 'Rohan Mehta',
    role: 'Treasurer',
    graduationYear: '2026',
    handoverStatus: 'Completed',
    email: 'rohan@campus.edu',
    linkedin: 'linkedin.com/in/rohan',
  },
];

const HANDOVER_TASKS = [
  'Transfer club bank account access',
  'Handover shared drive and documents',
  'Update alumni contact information',
  'Pass down event planning templates',
];

export default function AlumniHandover() {
  const [alumni, setAlumni] = useState<AlumniMember[]>(INITIAL_ALUMNI);
  const [selectedAlumniId, setSelectedAlumniId] = useState<string | null>(null);
  const [notification, setNotification] = useState('');

  const updateStatus = (id: string) => {
    setAlumni(prev => prev.map(member => {
      if (member.id === id) {
        const nextStatus = 
          member.handoverStatus === 'Pending' ? 'In Progress' :
          member.handoverStatus === 'In Progress' ? 'Completed' : 'Pending';
        return { ...member, handoverStatus: nextStatus };
      }
      return member;
    }));
  };

  const selectedAlumni = alumni.find(a => a.id === selectedAlumniId);
  const completedCount = alumni.filter(a => a.handoverStatus === 'Completed').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="bg-gradient-to-r from-amber-900/60 via-yellow-900/40 to-slate-900 border border-amber-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="absolute -right-10 -top-10 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-amber-500/20 text-amber-300 text-xs px-3 py-1 rounded-full font-semibold border border-amber-500/30 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5" /> Alumni Transition
                </span>
                <span className="text-slate-400 text-xs flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-yellow-400" /> {alumni.length} Alumni
                </span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-amber-200 bg-clip-text text-transparent">
                Club Leadership Alumni Transition Handover
              </h1>
              <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
                Manage the smooth transition of club responsibilities to alumni.
              </p>
            </div>
            <button 
              onClick={() => setNotification('Alumni transition system reset successfully!')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 rounded-xl font-medium transition flex items-center gap-2 border border-slate-700 text-sm"
            >
              <RefreshCcw className="w-4 h-4" /> Reset System
            </button>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/10 rounded-xl"><GraduationCap className="w-6 h-6 text-amber-400" /></div>
              <div>
                <p className="text-2xl font-bold">{alumni.length}</p>
                <p className="text-slate-400 text-xs">Total Alumni</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 rounded-xl"><CheckCircle2 className="w-6 h-6 text-emerald-400" /></div>
              <div>
                <p className="text-2xl font-bold">{completedCount}</p>
                <p className="text-slate-400 text-xs">Completed</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-500/10 rounded-xl"><AlertTriangle className="w-6 h-6 text-yellow-400" /></div>
              <div>
                <p className="text-2xl font-bold">{alumni.filter(a => a.handoverStatus !== 'Completed').length}</p>
                <p className="text-slate-400 text-xs">Pending</p>
              </div>
            </div>
          </div>
        </div>

        {/* Alumni List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900/80 border border-amber-500/20 rounded-3xl overflow-hidden">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-xl font-bold flex items-center gap-2"><Users className="w-5 h-5 text-amber-400" /> Alumni Directory</h2>
            </div>
            <div className="divide-y divide-slate-800">
              {alumni.map(member => (
                <div 
                  key={member.id} 
                  className={`p-6 flex items-center justify-between transition cursor-pointer hover:bg-slate-800/30 ${selectedAlumniId === member.id ? 'bg-slate-800/50 border-l-4 border-amber-500' : ''}`}
                  onClick={() => setSelectedAlumniId(member.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-xl">
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-lg">{member.name}</h3>
                      <p className="text-sm text-slate-400">{member.role}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Class of {member.graduationYear}</span>
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {member.email}</span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); updateStatus(member.id); }}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
                      member.handoverStatus === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                      member.handoverStatus === 'In Progress' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' :
                      'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> {member.handoverStatus}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Handover Details */}
          <div className="bg-slate-900/80 border border-amber-500/20 rounded-3xl p-6">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-6"><ClipboardList className="w-5 h-5 text-blue-400" /> Handover Details</h2>
            
            {selectedAlumni ? (
              <div className="space-y-4">
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <p className="text-sm text-slate-400">Selected Alumni</p>
                  <p className="text-xl font-bold text-white mt-1">{selectedAlumni.name}</p>
                  <p className="text-sm text-amber-400 font-medium">{selectedAlumni.role}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Handover Tasks</p>
                  <div className="space-y-2">
                    {HANDOVER_TASKS.map((task, index) => (
                      <div key={index} className="flex items-start gap-3 bg-slate-800/30 rounded-lg p-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                        <p className="text-sm text-slate-300">{task}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  <p className="text-xs text-amber-300 leading-relaxed">
                    This is a standalone dashboard component. It does not modify any existing backend data.
                  </p>
                </div>

                <button className="w-full bg-amber-600 hover:bg-amber-500 text-white py-3 rounded-xl font-medium transition shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2">
                  <Briefcase className="w-4 h-4" /> Export Handover Summary
                </button>
              </div>
            ) : (
              <div className="text-center py-16">
                <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500">Select an alumni to view handover details.</p>
              </div>
            )}
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
            <FileText className="w-6 h-6 text-amber-400" />
            <div>
              <h3 className="font-semibold text-white">Smooth Transition Guaranteed</h3>
              <p className="text-xs text-slate-400">Ensure every responsibility is passed down properly.</p>
            </div>
          </div>
          <ArrowRight className="w-6 h-6 text-slate-600" />
        </div>

      </div>
    </div>
  );
}