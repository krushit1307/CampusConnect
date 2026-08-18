import React from 'react';
import { Briefcase, Award, ShieldCheck, Calendar, UserPlus, Star } from 'lucide-react';

export interface AlumniMentor {
  id: string;
  mentorName: string;
  jobTitle: string;
  companyName: string;
  alumniGradYear: string;
  mentorAvatar: string;
  expertiseDomain: 'Software & AI Systems' | 'Finance & Consulting' | 'Product & Design';
  availableSlotsPerWeek: number;
  hourlyRateUSD: number;
  verificationStatus: string;
  bio: string;
  isBooked: boolean;
  ratingScore: number;
}

interface MentorProfileCardProps {
  mentor: AlumniMentor;
  onBook: () => void;
  onInspect: () => void;
}

export default function MentorProfileCard({ mentor, onBook, onInspect }: MentorProfileCardProps) {
  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:shadow-blue-500/10 flex flex-col justify-between group">
      <div>
        {/* Profile Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <img
              src={mentor.mentorAvatar}
              alt={mentor.mentorName}
              className="w-12 h-12 rounded-full border-2 border-blue-500/30 object-cover"
            />
            <div>
              <h3 className="text-base font-bold text-slate-100 group-hover:text-blue-300 transition flex items-center gap-1.5">
                {mentor.mentorName}
                <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
              </h3>
              <p className="text-xs text-slate-400 font-medium">{mentor.jobTitle}</p>
              <div className="text-[11px] text-blue-400 font-semibold">{mentor.companyName}</div>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded border border-amber-500/20 text-xs font-mono font-bold">
            <Star className="w-3 h-3 fill-current" /> {mentor.ratingScore}
          </div>
        </div>

        {/* Grad Year & Domain */}
        <div className="flex items-center gap-2 mb-3">
          <span className="bg-blue-500/10 text-blue-300 border border-blue-500/20 text-xs px-2.5 py-0.5 rounded-md font-semibold">
            {mentor.expertiseDomain}
          </span>
          <span className="bg-slate-800 text-slate-300 text-[11px] px-2 py-0.5 rounded-md">
            {mentor.alumniGradYear}
          </span>
        </div>

        <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed mb-4">
          {mentor.bio}
        </p>

        {/* Slots & Cost Box */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 mb-4 font-mono text-xs">
          <div className="flex justify-between text-slate-400 mb-1">
            <span>Weekly Slots:</span>
            <span className="text-emerald-400 font-bold">{mentor.availableSlotsPerWeek} Open</span>
          </div>
          <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-900">
            <span>Mentorship Fee:</span>
            <span className="text-slate-200 font-bold">FREE (Alumni Pay-It-Forward)</span>
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
        <span className="text-[11px] text-slate-500 font-mono">1-on-1 Zoom Session</span>
        <button
          onClick={onBook}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-md ${
            mentor.isBooked
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          {mentor.isBooked ? 'Session Booked' : 'Book 1-on-1'}
        </button>
      </div>
    </div>
  );
}
