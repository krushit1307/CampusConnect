import React from 'react';
import { Award, CheckCircle2, MessageSquare, Star, Clock, Zap, TrendingUp } from 'lucide-react';

interface ActivitySession {
  id: string;
  studentName: string;
  studentAvatar: string;
  mentorName: string;
  topic: string;
  completedTime: string;
  ratingGiven: number;
  reviewSnippet: string;
}

const RECENT_SESSIONS: ActivitySession[] = [
  {
    id: 'ses-1',
    studentName: 'Daniel Kim',
    studentAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    mentorName: 'Dr. Sophia Lin',
    topic: 'PhD Application Strategy & NLP Research Direction',
    completedTime: '20 mins ago',
    ratingGiven: 5,
    reviewSnippet: 'Sophia offered priceless critique on my statement of purpose and helped align my research proposal with top lab interests.',
  },
  {
    id: 'ses-2',
    studentName: 'Emily Watson',
    studentAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    mentorName: 'Julian Thorne',
    topic: 'C++ Systems Architecture & Low-Latency Data Structures',
    completedTime: '1 hour ago',
    ratingGiven: 5,
    reviewSnippet: 'Julian conducted an intensive mock technical round that prepared me thoroughly for my upcoming quant dev interview.',
  },
  {
    id: 'ses-3',
    studentName: 'Omar Farooq',
    studentAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    mentorName: 'Marcus Brody',
    topic: 'Figma Design System Architecture Portfolio Review',
    completedTime: '3 hours ago',
    ratingGiven: 5,
    reviewSnippet: 'Pointed out key usability issues in my design case study and gave actionable feedback on color tokens.',
  },
];

export default function MentorshipActivityTimeline() {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-md">
      {/* Overview Stat Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">1,420+</div>
            <div className="text-slate-400 text-xs font-medium">1-on-1 Sessions Conducted</div>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
            <Star className="w-6 h-6 fill-current" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">4.94 / 5.0</div>
            <div className="text-slate-400 text-xs font-medium">Average Mentorship Rating</div>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-teal-500/10 text-teal-400 rounded-xl border border-teal-500/20">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">92%</div>
            <div className="text-slate-400 text-xs font-medium">Interview Conversion Rate</div>
          </div>
        </div>
      </div>

      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <Clock className="w-5 h-5 text-emerald-400" /> Recent Completed Advisory Sessions
      </h3>

      <div className="space-y-4">
        {RECENT_SESSIONS.map((session) => (
          <div
            key={session.id}
            className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-5 hover:border-emerald-500/30 transition-all"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2.5">
                <img src={session.studentAvatar} alt={session.studentName} className="w-7 h-7 rounded-full border border-slate-700" />
                <span className="font-semibold text-slate-200 text-sm">{session.studentName}</span>
                <span className="text-slate-500 text-xs">completed session with</span>
                <span className="font-semibold text-emerald-400 text-sm">{session.mentorName}</span>
              </div>
              <span className="text-slate-500 text-xs">{session.completedTime}</span>
            </div>

            <div className="text-slate-300 font-medium text-xs mb-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800/80 inline-block">
              Topic: {session.topic}
            </div>

            <p className="text-slate-400 text-xs italic bg-slate-900/50 p-3 rounded-xl border border-slate-800/60 leading-relaxed">
              "{session.reviewSnippet}"
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
