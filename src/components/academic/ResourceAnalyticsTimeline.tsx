import React from 'react';
import { Clock, CheckCircle2, AlertCircle, ArrowUpRight, Flame, Trophy, Activity } from 'lucide-react';

interface TimelineEvent {
  id: string;
  user: string;
  avatar: string;
  action: 'uploaded' | 'reviewed' | 'bookmarked' | 'curated';
  targetResource: string;
  courseCode: string;
  timestamp: string;
  impactScore: number;
}

const TIMELINE_EVENTS: TimelineEvent[] = [
  {
    id: 'evt-1',
    user: 'Prof. Marcus Vance',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    action: 'uploaded',
    targetResource: 'Quantum Mechanics & Field Theory Past Midterm Exams',
    courseCode: 'PHYS402',
    timestamp: '15 mins ago',
    impactScore: 98,
  },
  {
    id: 'evt-2',
    user: 'David Chen',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    action: 'reviewed',
    targetResource: 'Advanced Data Structures Study Pack',
    courseCode: 'CS301',
    timestamp: '1 hour ago',
    impactScore: 85,
  },
  {
    id: 'evt-3',
    user: 'Sarah Jenkins',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    action: 'curated',
    targetResource: 'Organic Chemistry Lab Safety & Synthesis Bundle',
    courseCode: 'CHEM210',
    timestamp: '3 hours ago',
    impactScore: 92,
  },
  {
    id: 'evt-4',
    user: 'Alex Rivera',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    action: 'uploaded',
    targetResource: 'Decentralized Consensus Protocols Paper',
    courseCode: 'CS580',
    timestamp: '5 hours ago',
    impactScore: 95,
  },
];

export default function ResourceAnalyticsTimeline() {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-md">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">4,892</div>
            <div className="text-slate-400 text-xs font-medium">Monthly Active Downloads</div>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">128</div>
            <div className="text-slate-400 text-xs font-medium">Top Contributor Badges</div>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">99.4%</div>
            <div className="text-slate-400 text-xs font-medium">Peer Review Verification Rate</div>
          </div>
        </div>
      </div>

      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <Clock className="w-5 h-5 text-indigo-400" /> Peer Activity & Verification Stream
      </h3>

      {/* Timeline List */}
      <div className="relative pl-6 border-l-2 border-slate-800 space-y-8">
        {TIMELINE_EVENTS.map((event) => (
          <div key={event.id} className="relative group">
            {/* Timeline Node Icon */}
            <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-indigo-600 ring-4 ring-slate-950 group-hover:scale-125 transition-transform" />

            <div className="bg-slate-950/90 border border-slate-800/90 hover:border-indigo-500/40 rounded-2xl p-4 transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5">
                  <img src={event.avatar} alt={event.user} className="w-7 h-7 rounded-full border border-slate-700" />
                  <span className="font-semibold text-slate-200 text-sm">{event.user}</span>
                  <span className="text-slate-500 text-xs">{event.action}</span>
                  <span className="bg-indigo-500/10 text-indigo-400 text-[11px] font-mono px-2 py-0.5 rounded border border-indigo-500/20 font-medium">
                    {event.courseCode}
                  </span>
                </div>
                <span className="text-slate-500 text-xs">{event.timestamp}</span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="text-slate-300 text-sm font-medium hover:text-indigo-300 transition cursor-pointer flex items-center gap-1">
                  {event.targetResource}
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <div className="flex items-center gap-1 text-emerald-400 text-xs font-mono font-bold bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Impact: +{event.impactScore}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
