import React from 'react';
import { Users, Clock, CheckCircle2, Flame, Award, BookOpen } from 'lucide-react';

interface GroupSession {
  id: string;
  groupName: string;
  courseCode: string;
  topicCovered: string;
  durationMinutes: number;
  attendeesCount: number;
  loggedAgo: string;
}

const RECENT_SESSIONS: GroupSession[] = [
  {
    id: 'ses-1',
    groupName: 'Graph Theory & Dynamic Programming Sprint',
    courseCode: 'CS301',
    topicCovered: 'Dijkstra Shortest Path & Bellman-Ford Negative Cycle Detection',
    durationMinutes: 90,
    attendeesCount: 7,
    loggedAgo: '45 mins ago',
  },
  {
    id: 'ses-2',
    groupName: 'Schrödinger Equation Proof Working Circle',
    courseCode: 'PHYS402',
    topicCovered: 'Particle in a 3D Infinite Potential Well Normalization',
    durationMinutes: 120,
    attendeesCount: 5,
    loggedAgo: '3 hours ago',
  },
  {
    id: 'ses-3',
    groupName: 'Eigenvalues & Vector Space Study Lab',
    courseCode: 'MATH220',
    topicCovered: 'Gram-Schmidt Orthogonalization Process & QR Decomposition',
    durationMinutes: 60,
    attendeesCount: 8,
    loggedAgo: '5 hours ago',
  },
];

export default function StudyGroupActivityTimeline() {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-md">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">1,890</div>
            <div className="text-slate-400 text-xs font-medium">Weekly Active Study Hours</div>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">96.4%</div>
            <div className="text-slate-400 text-xs font-medium">Session Completion Rate</div>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">312</div>
            <div className="text-slate-400 text-xs font-medium">Active Peer Study Sessions</div>
          </div>
        </div>
      </div>

      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <Clock className="w-5 h-5 text-cyan-400" /> Recent Completed Peer Study Sessions
      </h3>

      <div className="space-y-4">
        {RECENT_SESSIONS.map((session) => (
          <div
            key={session.id}
            className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-5 hover:border-cyan-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-cyan-500/10 text-cyan-400 text-[11px] font-mono px-2 py-0.5 rounded border border-cyan-500/20 font-bold">
                  {session.courseCode}
                </span>
                <span className="text-slate-500 text-xs">{session.loggedAgo}</span>
              </div>
              <h4 className="text-base font-bold text-slate-100">{session.groupName}</h4>
              <div className="text-xs text-slate-400 mt-1">
                Topic: <span className="text-slate-200 font-semibold">{session.topicCovered}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-slate-300 text-xs font-mono bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                ⏱ {session.durationMinutes} mins • {session.attendeesCount} Students
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
