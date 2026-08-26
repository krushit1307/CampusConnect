import React from 'react';
import { Award, CheckCircle2, ShieldCheck, Star, Clock } from 'lucide-react';

interface MentorshipSessionActivity {
  id: string;
  mentorName: string;
  companyName: string;
  studentName: string;
  topicTitle: string;
  ratingGiven: number;
  completedAgo: string;
}

const RECENT_MENTORSHIP_ACTIVITY: MentorshipSessionActivity[] = [
  {
    id: 'ses-1',
    mentorName: 'Sophia Lin',
    companyName: 'Google',
    studentName: 'Lucas Vance',
    topicTitle: 'Google SWE Resume Review & System Design Prep',
    ratingGiven: 5.0,
    completedAgo: '45 mins ago',
  },
  {
    id: 'ses-2',
    mentorName: 'Marcus Vance',
    companyName: 'Goldman Sachs',
    studentName: 'David Chen',
    topicTitle: 'Tech M&A Financial Modeling Mock Interview',
    ratingGiven: 5.0,
    completedAgo: '2 hours ago',
  },
  {
    id: 'ses-3',
    mentorName: 'Elena Rostova',
    companyName: 'Stripe',
    studentName: 'Chloe Bennett',
    topicTitle: 'APM Product Strategy & Case Interview',
    ratingGiven: 4.9,
    completedAgo: '5 hours ago',
  },
];

export default function AlumniActivityTimeline() {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-md">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">850+</div>
            <div className="text-slate-400 text-xs font-medium">1-on-1 Sessions Completed</div>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">100%</div>
            <div className="text-slate-400 text-xs font-medium">Verified Alumni Mentors</div>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
            <Star className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">4.96 / 5.0</div>
            <div className="text-slate-400 text-xs font-medium">Average Session Rating</div>
          </div>
        </div>
      </div>

      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <Clock className="w-5 h-5 text-blue-400" /> Recent Completed Alumni 1-on-1 Sessions
      </h3>

      <div className="space-y-4">
        {RECENT_MENTORSHIP_ACTIVITY.map((item) => (
          <div
            key={item.id}
            className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-5 hover:border-blue-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-blue-500/10 text-blue-400 text-[11px] font-mono px-2 py-0.5 rounded border border-blue-500/20 font-bold">
                  {item.companyName} Alumni
                </span>
                <span className="text-slate-500 text-xs font-mono">{item.completedAgo}</span>
              </div>
              <h4 className="text-base font-bold text-slate-100">{item.topicTitle}</h4>
              <div className="text-xs text-slate-400 mt-1 font-mono">
                Mentor: <span className="text-slate-200 font-semibold">{item.mentorName}</span> • Student: <span className="text-slate-200 font-semibold">{item.studentName}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-amber-300 font-mono font-extrabold text-xs bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20 flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-current text-amber-400" /> {item.ratingGiven} Score
              </div>
              <div className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Session Done
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
